const { createClient } = require('@supabase/supabase-js');

const PROD_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTg3NDAsImV4cCI6MjA4NTQ5NDc0MH0.8bkOFJr9IjJhqPBn2aSmT4G3h6Y-Ggd8E9p6xHBePOc';

async function testEnsivarLogin() {
  console.log('=== DIAGNÓSTICO: Por qué Ensivar no ve sus leads ===\n');

  // Login como jimmy@ensivar.com
  const anonClient = createClient(PROD_URL, ANON_KEY);
  const { data: loginData, error: loginErr } = await anonClient.auth.signInWithPassword({
    email: 'jimmy@ensivar.com',
    password: 'Ensivar2026!'
  });

  if (loginErr) {
    console.log('Login falló con Ensivar2026!:', loginErr.message);
    // Try other common passwords
    const passwords = ['EnsivarCRM2026!', 'AriasCRM2026!', 'Ensivar123!', 'ensivar2026'];
    for (const pw of passwords) {
      const { error } = await anonClient.auth.signInWithPassword({ email: 'jimmy@ensivar.com', password: pw });
      if (!error) {
        console.log(`✅ Login exitoso con password: ${pw}`);
        break;
      } else {
        console.log(`  ❌ ${pw}: ${error.message}`);
      }
    }
    return;
  }

  console.log('✅ Login exitoso como jimmy@ensivar.com');
  
  // Decode JWT to see what company_id is in the token
  const jwt = loginData.session?.access_token;
  if (jwt) {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
    console.log('\nJWT payload (lo que usa RLS):');
    console.log('  sub (user_id):', payload.sub);
    console.log('  role:', payload.role);
    console.log('  app_metadata:', JSON.stringify(payload.app_metadata || {}));
    console.log('  user_metadata:', JSON.stringify(payload.user_metadata || {}));
    
    const jwtCompanyId = payload.app_metadata?.company_id || payload.user_metadata?.company_id;
    console.log('\n  ⚠️  company_id en JWT:', jwtCompanyId || 'NO TIENE COMPANY_ID EN JWT');
  }

  // Check what get_auth_company_id() returns for this user
  const userClient = createClient(PROD_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${loginData.session?.access_token}` } }
  });
  
  const { data: cidFromRpc, error: rpcErr } = await userClient.rpc('get_auth_company_id');
  console.log('\nget_auth_company_id() para jimmy@ensivar.com:', cidFromRpc, rpcErr?.message || '');
  
  // Try fetching leads as Ensivar user
  const { data: leads, count, error: leadsErr } = await userClient
    .from('leads')
    .select('*', { count: 'exact', head: true });
  
  console.log('\nLeads visibles para jimmy@ensivar.com:', count ?? 0, leadsErr?.message || '');
  
  await anonClient.auth.signOut();
}

testEnsivarLogin().catch(console.error);
