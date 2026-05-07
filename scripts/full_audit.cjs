/**
 * AUDITORÍA EXHAUSTIVA DEL CRM SAAS
 * =====================================
 * Verifica TODOS los puntos críticos del sistema multi-tenant
 * Corre: node scripts/full_audit.cjs
 */
const { createClient } = require('@supabase/supabase-js');

const PROD_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const supabase = createClient(PROD_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const COMPANIES = {
  '7a582ba5-f7d0-4ae3-9985-35788deb1c30': 'Arias Defense',
  'ec88dff0-94a2-4544-ad2e-1f93a8163366': 'Ensivar',
  '00000000-0000-0000-0000-000000000000': 'Sistema',
};

let totalIssues = 0;
const issues = [];

function pass(msg)  { console.log(`  ✅ ${msg}`); }
function warn(msg)  { console.log(`  ⚠️  ${msg}`); issues.push({level:'warn', msg}); totalIssues++; }
function fail(msg)  { console.log(`  ❌ ${msg}`); issues.push({level:'fail', msg}); totalIssues++; }
function info(msg)  { console.log(`  ℹ️  ${msg}`); }
function section(title) { console.log(`\n${'═'.repeat(55)}\n  ${title}\n${'═'.repeat(55)}`); }

async function runAudit() {
  console.log('\n🔍 AUDITORÍA EXHAUSTIVA CRM SAAS');
  console.log('   Proyecto: mtxqqamitglhehaktgxm (crm-app)');
  console.log(`   Fecha: ${new Date().toISOString()}`);

  // ─────────────────────────────────────────────
  section('1. INTEGRIDAD DE DATOS POR EMPRESA');
  // ─────────────────────────────────────────────

  const { data: allLeads } = await supabase.from('leads').select('id, company_id, name');
  
  // Count by company
  const leadsByCompany = {};
  allLeads?.forEach(l => { leadsByCompany[l.company_id] = (leadsByCompany[l.company_id] || 0) + 1; });
  
  for (const [cid, count] of Object.entries(leadsByCompany)) {
    const name = COMPANIES[cid] || `DESCONOCIDO(${cid.substring(0,8)}...)`;
    if (!COMPANIES[cid]) {
      fail(`Leads con company_id DESCONOCIDO: ${count} leads → ${cid}`);
    } else {
      pass(`${name}: ${count} leads`);
    }
  }

  // Orphan leads (no company_id)
  const orphans = allLeads?.filter(l => !l.company_id) || [];
  if (orphans.length > 0) fail(`${orphans.length} leads SIN company_id (orphans)`);
  else pass('Sin leads huérfanos (todos tienen company_id)');

  // Ensivar minimum threshold
  const ensivarCount = leadsByCompany['ec88dff0-94a2-4544-ad2e-1f93a8163366'] || 0;
  if (ensivarCount < 80) fail(`Ensivar tiene solo ${ensivarCount} leads — mínimo esperado: 80`);
  else pass(`Ensivar tiene ${ensivarCount} leads (≥80 ✓)`);

  // Arias minimum threshold
  const ariasCount = leadsByCompany['7a582ba5-f7d0-4ae3-9985-35788deb1c30'] || 0;
  if (ariasCount < 800) warn(`Arias Defense tiene ${ariasCount} leads — mínimo esperado: 800`);
  else pass(`Arias Defense tiene ${ariasCount} leads (≥800 ✓)`);

  // ─────────────────────────────────────────────
  section('2. ALINEACIÓN USUARIOS ↔ EMPRESAS');
  // ─────────────────────────────────────────────

  const { data: profiles } = await supabase.from('profiles').select('id, email, company_id, role');
  const { data: companies } = await supabase.from('companies').select('id, name');
  const validCids = new Set(companies?.map(c => c.id));

  let profileIssues = 0;
  for (const p of (profiles || [])) {
    if (!p.company_id) {
      fail(`Usuario SIN empresa: ${p.email} (id: ${p.id})`);
      profileIssues++;
    } else if (!validCids.has(p.company_id)) {
      fail(`Usuario con empresa INVÁLIDA: ${p.email} → ${p.company_id}`);
      profileIssues++;
    }
  }
  if (profileIssues === 0) pass(`Todos los ${profiles?.length} usuarios tienen empresa válida`);

  // Group profiles by company
  const profilesByCompany = {};
  profiles?.forEach(p => {
    const name = COMPANIES[p.company_id] || 'Otro';
    profilesByCompany[name] = (profilesByCompany[name] || []);
    profilesByCompany[name].push(p.email);
  });
  for (const [company, emails] of Object.entries(profilesByCompany)) {
    info(`${company}: ${emails.join(', ')}`);
  }

  // ─────────────────────────────────────────────
  section('3. JWT app_metadata (CRÍTICO PARA RLS)');
  // ─────────────────────────────────────────────

  // Check auth.users app_metadata via admin API
  const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 100 });
  
  if (usersErr) {
    fail(`No se pudo obtener lista de usuarios: ${usersErr.message}`);
  } else {
    let jwtIssues = 0;
    for (const u of users) {
      const jwtCid = u.app_metadata?.company_id;
      const profile = profiles?.find(p => p.id === u.id);
      const profileCid = profile?.company_id;

      if (!jwtCid && profileCid) {
        fail(`JWT sin company_id: ${u.email} (profile tiene: ${COMPANIES[profileCid] || profileCid})`);
        jwtIssues++;
      } else if (jwtCid && profileCid && jwtCid !== profileCid) {
        fail(`JWT company_id INCONSISTENTE para ${u.email}: JWT=${jwtCid} ≠ Profile=${profileCid}`);
        jwtIssues++;
      } else if (jwtCid) {
        pass(`JWT OK: ${u.email} → ${COMPANIES[jwtCid] || jwtCid}`);
      }
    }
    if (jwtIssues === 0) pass(`Todos los ${users.length} usuarios tienen JWT app_metadata correcto`);
  }

  // ─────────────────────────────────────────────
  section('4. CROSS-TENANT DATA LEAKAGE TEST');
  // ─────────────────────────────────────────────

  // Check every table with company_id for unknown company_ids
  const TABLES = ['leads', 'clients', 'follow_ups', 'cotizaciones', 'tickets', 'marketing_campaigns', 'marketing_conversations'];
  
  for (const table of TABLES) {
    const { data } = await supabase.from(table).select('company_id');
    if (!data || data.length === 0) {
      info(`${table}: vacío`);
      continue;
    }
    const unknownCids = data.filter(r => r.company_id && !COMPANIES[r.company_id]);
    if (unknownCids.length > 0) {
      fail(`${table}: ${unknownCids.length} registros con company_id DESCONOCIDO`);
    } else {
      const counts = {};
      data.forEach(r => { counts[COMPANIES[r.company_id] || 'null'] = (counts[COMPANIES[r.company_id] || 'null'] || 0) + 1; });
      const summary = Object.entries(counts).map(([k,v]) => `${k}:${v}`).join(', ');
      pass(`${table}: ${summary}`);
    }
  }

  // ─────────────────────────────────────────────
  section('5. RLS POLICIES (AISLAMIENTO)');
  // ─────────────────────────────────────────────

  // Check via pg_policies that leads table has RLS enabled
  const { data: rlsPolicies } = await supabase
    .from('pg_policies')
    .select('tablename, policyname, cmd, qual')
    .eq('tablename', 'leads');

  if (!rlsPolicies || rlsPolicies.length === 0) {
    fail('NO hay políticas RLS en la tabla leads — CRÍTICO');
  } else {
    pass(`Tabla leads: ${rlsPolicies.length} políticas RLS activas`);
    // Check for super_admin bypass
    const bypassPolicies = rlsPolicies.filter(p => p.qual?.includes('super_admin') && !p.qual?.includes('company_id'));
    if (bypassPolicies.length > 0) {
      fail(`Políticas con bypass super_admin sin company_id: ${bypassPolicies.map(p => p.policyname).join(', ')}`);
    } else {
      pass('Sin bypass inseguro de super_admin en leads');
    }
  }

  // ─────────────────────────────────────────────
  section('6. COMPANIES TABLE INTEGRIDAD');
  // ─────────────────────────────────────────────

  if (!companies || companies.length === 0) {
    fail('TABLA COMPANIES VACÍA — crítico para onboarding');
  } else {
    pass(`${companies.length} empresas registradas:`);
    companies.forEach(c => info(`  ${c.name} (${c.id})`));
  }

  // ─────────────────────────────────────────────
  section('7. DATOS HUÉRFANOS ENTRE TABLAS');
  // ─────────────────────────────────────────────

  // Follow-ups without valid lead
  const { data: followUps } = await supabase.from('follow_ups').select('id, lead_id');
  const { data: leadIds } = await supabase.from('leads').select('id');
  const validLeadIds = new Set(leadIds?.map(l => l.id));
  const orphanFollowUps = followUps?.filter(f => !validLeadIds.has(f.lead_id)) || [];
  if (orphanFollowUps.length > 0) warn(`${orphanFollowUps.length} follow_ups sin lead válido`);
  else pass(`Todos los follow_ups tienen lead válido (${followUps?.length} total)`);

  // ─────────────────────────────────────────────
  section('RESUMEN EJECUTIVO');
  // ─────────────────────────────────────────────

  console.log(`\n  Total de issues encontrados: ${totalIssues}`);
  
  const fails = issues.filter(i => i.level === 'fail');
  const warns = issues.filter(i => i.level === 'warn');

  if (fails.length === 0 && warns.length === 0) {
    console.log('\n  🟢 SISTEMA SAAS: SALUDABLE — Listo para clientes');
  } else {
    if (fails.length > 0) {
      console.log(`\n  🔴 CRÍTICOS (${fails.length}):`);
      fails.forEach(i => console.log(`     • ${i.msg}`));
    }
    if (warns.length > 0) {
      console.log(`\n  🟡 ADVERTENCIAS (${warns.length}):`);
      warns.forEach(i => console.log(`     • ${i.msg}`));
    }
  }

  console.log(`\n  Fecha: ${new Date().toISOString()}\n`);
}

runAudit().catch(console.error);
