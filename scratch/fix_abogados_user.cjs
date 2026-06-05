// Fix broken phone constraint in auth.users, then create the client user
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';

const h = { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY, 'Content-Type': 'application/json' };

async function go() {
  // 1. Fix phone='' -> NULL via the pg function we can call
  console.log('1. Fixing phone constraint...');
  const fixPhone = await fetch(`${URL}/rest/v1/rpc/fix_auth_phone_nulls`, { method: 'POST', headers: h, body: '{}' });
  console.log('   fix_phone status:', fixPhone.status, await fixPhone.text().catch(() => ''));

  // 2. Try creating user directly 
  console.log('2. Creating user...');
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST', headers: h,
    body: JSON.stringify({
      email: 'admin@abogadosyasociados.com',
      password: 'AbogadosCRM2026!',
      email_confirm: true,
      user_metadata: { full_name: 'Administrador' }
    })
  });
  const d = await r.json();
  console.log('   status:', r.status, JSON.stringify(d).substring(0, 400));

  if (r.status !== 200 && r.status !== 201) {
    // 3. User might already exist - try to list all users and find it
    console.log('3. Searching all users...');
    const list = await fetch(`${URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: h });
    const ld = await list.json();
    const found = ld.users?.find(u => u.email === 'admin@abogadosyasociados.com');
    if (found) {
      console.log('   Found existing user:', found.id, 'confirmed:', found.email_confirmed_at);
      // Update password
      const upd = await fetch(`${URL}/auth/v1/admin/users/${found.id}`, {
        method: 'PUT', headers: h,
        body: JSON.stringify({ password: 'AbogadosCRM2026!', email_confirm: true })
      });
      const ud = await upd.json();
      console.log('   Updated:', upd.status, JSON.stringify(ud).substring(0, 200));
      d.id = found.id;
    } else {
      console.log('   Not found in user list. Errors:', JSON.stringify(ld).substring(0, 200));
      return;
    }
  }

  const userId = d.id;
  console.log('\n4. User ID:', userId);

  // 5. Get company
  const cRes = await fetch(`${URL}/rest/v1/companies?name=ilike.*abogados*&select=id,name`, { headers: h });
  const companies = await cRes.json();
  console.log('5. Companies:', JSON.stringify(companies));

  const companyId = companies[0]?.id;
  if (!companyId) { console.error('No company found!'); return; }

  // 6. Upsert profile
  const pRes = await fetch(`${URL}/rest/v1/profiles`, {
    method: 'POST', headers: { ...h, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: userId, email: 'admin@abogadosyasociados.com', full_name: 'Administrador', role: 'company_admin', company_id: companyId, is_active: true })
  });
  console.log('6. Profile:', pRes.status, (await pRes.json().catch(() => ({}))));

  // 7. Test login
  console.log('\n7. Testing login...');
  const login = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { 'apikey': SERVICE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@abogadosyasociados.com', password: 'AbogadosCRM2026!' })
  });
  const ld2 = await login.json();
  if (ld2.access_token) {
    console.log('✅ LOGIN WORKS! Client can enter now.');
  } else {
    console.error('❌ Login error:', JSON.stringify(ld2));
  }
}
go().catch(console.error);
