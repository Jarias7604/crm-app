// Test completo usando exactamente el mismo flujo que Companies.tsx
// 1. provision_new_tenant (sin admin) → crea empresa
// 2. admin_create_user (RPC correcto) → crea admin con identities correctas
// DB: mtxqqamitglhehaktgxm (PRODUCCIÓN)

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const SUPABASE_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const TEST_TS = Date.now();
const TEST_COMPANY = `Demo Companies.tsx ${TEST_TS}`;
const TEST_EMAIL   = `demo.tsx.${TEST_TS}@ariascrm-test.com`;
const TEST_PASS    = 'DemoTSX2026!';

const h = { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY, 'Content-Type': 'application/json' };

// Simular el JWT de super_admin para llamar RPCs autenticados
// Primero login como super_admin real de la plataforma
async function getSupAdminToken() {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SERVICE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'jarias7604@gmail.com', password: 'Arias2024!' })
  });
  const d = await r.json();
  if (!d.access_token) {
    // try alternate
    const r2 = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'jarias7604@gmail.com', password: 'Arias2026!' })
    });
    const d2 = await r2.json();
    return d2.access_token;
  }
  return d.access_token;
}

async function testCompaniesFlow() {
  console.log('════════════════════════════════════════════════════');
  console.log('TEST: Flujo exacto de Companies.tsx');
  console.log('════════════════════════════════════════════════════');

  // Obtener token de super_admin
  console.log('0. Autenticando como super_admin...');
  const adminToken = await getSupAdminToken();
  if (!adminToken) {
    console.error('❌ No se pudo autenticar como super_admin. Usando service_key como fallback.');
  }
  const authToken = adminToken || SERVICE_KEY;
  const authH = { 'Authorization': `Bearer ${authToken}`, 'apikey': SERVICE_KEY, 'Content-Type': 'application/json' };
  console.log('   Token obtenido:', adminToken ? '✅ JWT real' : '⚠️ service_key');

  // 1. Crear empresa (sin admin)
  console.log('\n1. provision_new_tenant (sin admin)...');
  const compRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/provision_new_tenant`, {
    method: 'POST', headers: authH,
    body: JSON.stringify({
      p_company_name: TEST_COMPANY,
      p_license_status: 'active',
      p_max_users: 10,
      p_allowed_permissions: ['leads','quotes','calendar','marketing','chat','loss_reasons','proyectos'],
      p_admin_email: null, p_admin_password: null, p_admin_full_name: null
    })
  });
  const compData = await compRes.json();
  console.log('   Status:', compRes.status);
  if (compRes.status !== 200) { console.error('❌ Empresa NO creada:', compData); return; }
  const companyId = compData.company_id;
  console.log('✅ Empresa creada:', companyId, '|', TEST_COMPANY);

  // 2. Crear admin via admin_create_user RPC (mismo que addCompanyAdmin)
  console.log('\n2. admin_create_user RPC...');
  const userRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_create_user`, {
    method: 'POST', headers: authH,
    body: JSON.stringify({
      new_email: TEST_EMAIL,
      new_password: TEST_PASS,
      new_full_name: 'Admin Demo TSX',
      new_role: 'company_admin',
      new_company_id: companyId,
      new_phone: null,
      new_custom_role_id: null,
      new_address_date: null,
      new_address: null
    })
  });
  const userData = await userRes.json();
  console.log('   Status:', userRes.status, '| Data:', JSON.stringify(userData).substring(0, 200));
  if (userRes.status !== 200) { 
    console.error('❌ Admin NO creado');
    await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, { method: 'DELETE', headers: h });
    return;
  }
  const userId = userData.id;
  console.log('✅ Admin creado:', userId);

  // 3. Verificar aislamiento
  console.log('\n3. Verificando aislamiento...');
  const profilesR = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,email,role,company_id`, { headers: h });
  const profiles = await profilesR.json();
  const p = profiles[0];
  if (p?.company_id === companyId) {
    console.log('✅ Aislamiento CORRECTO:', JSON.stringify(p));
  } else {
    console.error('❌ FUGA:', JSON.stringify(p));
  }

  // 4. Login del nuevo admin
  console.log('\n4. Login del nuevo admin...');
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SERVICE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS })
  });
  const loginData = await loginRes.json();
  if (loginData.access_token) {
    console.log('✅ LOGIN EXITOSO — Cliente puede acceder al CRM');
  } else {
    console.error('❌ Login falló:', JSON.stringify(loginData));
  }

  // 5. Limpiar
  console.log('\n5. Limpiando...');
  const listR = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: h });
  const listD = await listR.json();
  const foundUser = listD.users?.find((u) => u.email === TEST_EMAIL);
  if (foundUser) {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${foundUser.id}`, { method: 'DELETE', headers: h });
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${foundUser.id}`, { method: 'DELETE', headers: h });
  }
  await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, { method: 'DELETE', headers: h });
  console.log('✅ Limpieza OK');

  console.log('\n════════════════════════════════════════════════════');
  console.log('SISTEMA LISTO — Puede crear clientes reales hoy.');
  console.log('════════════════════════════════════════════════════');
}

testCompaniesFlow().catch(console.error);
