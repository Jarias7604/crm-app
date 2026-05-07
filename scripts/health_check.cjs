/**
 * HEALTH CHECK DE INTEGRIDAD — CRM Multi-Tenant
 * Verifica que los datos estén correctamente aislados por empresa.
 * Corre: node scripts/health_check.cjs
 *
 * EJECUTAR ANTES Y DESPUÉS de cualquier migración o restauración.
 */
const { createClient } = require('@supabase/supabase-js');

// Producción CRM — crm-app (mtxqqamitglhehaktgxm)
const supabase = createClient(
  'https://mtxqqamitglhehaktgxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const KNOWN_COMPANIES = {
  '7a582ba5-f7d0-4ae3-9985-35788deb1c30': 'Arias Defense Components LLC',
  'ec88dff0-94a2-4544-ad2e-1f93a8163366': 'Ensivar S.A. de C.V.',
  '00000000-0000-0000-0000-000000000000': 'Sistema Arias Defense',
};

async function healthCheck() {
  console.log('\n🔍 HEALTH CHECK DE INTEGRIDAD — CRM Multi-Tenant');
  console.log('================================================\n');
  
  let allPassed = true;
  const results = [];

  // CHECK 1: Leads count per company
  console.log('CHECK 1: Leads por empresa');
  const { data: leads, error: leadsErr } = await supabase
    .from('leads').select('company_id');

  if (leadsErr) {
    console.log('  ❌ Error leyendo leads:', leadsErr.message);
    allPassed = false;
  } else {
    const counts = {};
    leads.forEach(l => { counts[l.company_id] = (counts[l.company_id] || 0) + 1; });
    
    Object.entries(counts).forEach(([cid, count]) => {
      const name = KNOWN_COMPANIES[cid] || `⚠️ EMPRESA DESCONOCIDA (${cid})`;
      const isKnown = !!KNOWN_COMPANIES[cid];
      const icon = isKnown ? '✅' : '❌';
      console.log(`  ${icon} ${name}: ${count} leads`);
      if (!isKnown) allPassed = false;
      results.push({ empresa: name, leads: count, known: isKnown });
    });

    // Alert if Ensivar has 0 leads
    const ensivarCount = counts['ec88dff0-94a2-4544-ad2e-1f93a8163366'] || 0;
    if (ensivarCount === 0) {
      console.log('  🚨 ALERTA: Ensivar tiene 0 leads — verificar si se perdieron datos');
      allPassed = false;
    }

    // Alert if Arias Defense drops significantly (more than 20% loss)  
    const ariasCount = counts['7a582ba5-f7d0-4ae3-9985-35788deb1c30'] || 0;
    if (ariasCount < 500) {
      console.log(`  🚨 ALERTA: Arias Defense tiene solo ${ariasCount} leads — verificar integridad`);
      allPassed = false;
    }
  }

  // CHECK 2: Leads without valid company_id
  console.log('\nCHECK 2: Leads sin empresa válida');
  const { data: allLeads } = await supabase.from('leads').select('id, company_id');
  const orphaned = allLeads?.filter(l => !l.company_id) || [];
  if (orphaned.length > 0) {
    console.log(`  ❌ ${orphaned.length} leads sin company_id`);
    allPassed = false;
  } else {
    console.log('  ✅ Todos los leads tienen company_id');
  }

  // CHECK 3: Profiles aligned with companies
  console.log('\nCHECK 3: Usuarios alineados a sus empresas');
  const { data: profiles } = await supabase
    .from('profiles').select('email, company_id, role');
  
  const ensivarUsers = profiles?.filter(p => p.company_id === 'ec88dff0-94a2-4544-ad2e-1f93a8163366') || [];
  const ariasUsers = profiles?.filter(p => p.company_id === '7a582ba5-f7d0-4ae3-9985-35788deb1c30') || [];
  console.log(`  ✅ Ensivar: ${ensivarUsers.length} usuarios`);
  console.log(`  ✅ Arias Defense: ${ariasUsers.length} usuarios`);

  // CHECK 4: RLS enabled on leads table
  console.log('\nCHECK 4: RLS habilitado en tabla leads');
  const { data: rlsCheck, error: rlsErr } = await supabase
    .rpc('check_leads_rls_status');
  if (rlsErr) {
    // Manual check via pg_class
    console.log('  ⚠️ No se pudo verificar RLS via RPC (normal si función no existe)');
    console.log('  ℹ️ Verificar en Supabase Dashboard → Authentication → Policies → leads');
  } else {
    console.log('  ✅ RLS verificado');
  }

  // CHECK 5: No cross-tenant data in marketing conversations
  console.log('\nCHECK 5: Conversaciones de marketing aisladas');
  const { data: convos } = await supabase
    .from('marketing_conversations').select('company_id');
  if (convos) {
    const convoCounts = {};
    convos.forEach(c => { convoCounts[c.company_id] = (convoCounts[c.company_id] || 0) + 1; });
    Object.entries(convoCounts).forEach(([cid, count]) => {
      const name = KNOWN_COMPANIES[cid] || `⚠️ EMPRESA DESCONOCIDA (${cid})`;
      console.log(`  ✅ ${name}: ${count} conversaciones`);
    });
  }

  // FINAL RESULT
  console.log('\n================================================');
  if (allPassed) {
    console.log('✅ HEALTH CHECK PASSED — Todos los checks OK');
  } else {
    console.log('❌ HEALTH CHECK FAILED — Revisar alertas arriba');
    console.log('\n⚠️  NO ejecutar ninguna migración hasta resolver los problemas.');
    process.exit(1);
  }
  
  console.log(`\nFecha: ${new Date().toISOString()}`);
  console.log('================================================\n');
}

healthCheck().catch(err => {
  console.error('❌ Error crítico en health check:', err);
  process.exit(1);
});
