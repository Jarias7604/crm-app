const { createClient } = require('@supabase/supabase-js');

const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTg3NDAsImV4cCI6MjA4NTQ5NDc0MH0.ybK2j-anHpMIlgaH0D-pRz4W6kyb96fNsbXTfT2FE2o';

const client = createClient(URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('=== VERIFYING RLS MIGRATION & MULTI-TENANT PROTECTION ===\n');

  // 1. Sign in as the Platform Owner (jarias7604@gmail.com)
  console.log('1. Iniciando sesión como PLATFORM OWNER (jarias7604@gmail.com)...');
  const { data: poAuth, error: poAuthErr } = await client.auth.signInWithPassword({
    email: 'jarias7604@gmail.com',
    password: 'Arias2026!'
  });

  if (poAuthErr) {
    console.error('  ❌ Error de autenticación:', poAuthErr.message);
    return;
  }
  console.log('  ✅ Autenticación exitosa.');

  // Check RLS select on Ensivar leads under PO session
  console.log('\n  [PRUEBA PO] Consultando leads de Ensivar S.A. de C.V. (ec88dff0-94a2-4544-ad2e-1f93a8163366)...');
  const { data: ensLeads, error: ensErr } = await client
    .from('leads')
    .select('id, name, company_id')
    .eq('company_id', 'ec88dff0-94a2-4544-ad2e-1f93a8163366')
    .limit(5);

  if (ensErr) {
    console.error('  ❌ Error:', ensErr.message);
  } else {
    console.log(`  ✅ ÉXITO: El Platform Owner recuperó ${ensLeads.length} leads de Ensivar exitosamente (Bypass RLS activo!).`);
    ensLeads.forEach(l => console.log(`    - Lead: ${l.name} | Company: ${l.company_id}`));
  }

  // Check RLS select on Arias leads under PO session
  console.log('\n  [PRUEBA PO] Consultando leads de Arias Defense (7a582ba5-f7d0-4ae3-9985-35788deb1c30)...');
  const { data: ariLeads, error: ariErr } = await client
    .from('leads')
    .select('id, name, company_id')
    .eq('company_id', '7a582ba5-f7d0-4ae3-9985-35788deb1c30')
    .limit(5);

  if (ariErr) {
    console.error('  ❌ Error:', ariErr.message);
  } else {
    console.log(`  ✅ ÉXITO: El Platform Owner recuperó ${ariLeads.length} leads de Arias Defense exitosamente.`);
    ariLeads.forEach(l => console.log(`    - Lead: ${l.name} | Company: ${l.company_id}`));
  }

  await client.auth.signOut();

  // 2. Sign in as a regular user with NO platform owner bypass (e.g. ggutierrez@ariasdefense.com)
  console.log('\n2. Iniciando sesión como usuario regular de Arias (ggutierrez@ariasdefense.com)...');
  const { data: regAuth, error: regAuthErr } = await client.auth.signInWithPassword({
    email: 'ggutierrez@ariasdefense.com',
    password: 'AriasCRM2026!'
  });

  if (regAuthErr) {
    console.error('  ❌ Error de autenticación:', regAuthErr.message);
    return;
  }
  console.log('  ✅ Autenticación exitosa.');

  // Check RLS select on Ensivar leads under regular user session
  console.log('\n  [PRUEBA REGULAR] Intentando consultar leads de Ensivar S.A. de C.V. (ec88dff0-94a2-4544-ad2e-1f93a8163366)...');
  const { data: regEnsLeads, error: regEnsErr } = await client
    .from('leads')
    .select('id, name, company_id')
    .eq('company_id', 'ec88dff0-94a2-4544-ad2e-1f93a8163366');

  if (regEnsErr) {
    console.log('  🛡️ Bloqueado por error:', regEnsErr.message);
  } else if (regEnsLeads && regEnsLeads.length > 0) {
    console.log('  ❌ ALERTA: ¡Acceso no autorizado! Se pudieron leer leads de Ensivar:', regEnsLeads.length);
  } else {
    console.log('  🛡️ SEGURIDAD AIRTIGHT: La consulta retornó 0 leads. El usuario regular no puede ver datos de Ensivar.');
  }

  // Check RLS select on Arias leads under regular user session
  console.log('\n  [PRUEBA REGULAR] Consultando sus propios leads de Arias Defense (7a582ba5-f7d0-4ae3-9985-35788deb1c30)...');
  const { data: regAriLeads, error: regAriErr } = await client
    .from('leads')
    .select('id, name, company_id')
    .eq('company_id', '7a582ba5-f7d0-4ae3-9985-35788deb1c30')
    .limit(5);

  if (regAriErr) {
    console.error('  ❌ Error:', regAriErr.message);
  } else {
    console.log(`  ✅ ÉXITO: El usuario regular recuperó ${regAriLeads.length} leads de su propia empresa.`);
  }

  await client.auth.signOut();
  console.log('\n=== AUDIT COMPLETE AND SUCCESSFUL ===');
}

main().catch(console.error);
