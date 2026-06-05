// FASE 1: Eliminar usuario de prueba de producción
// DB: mtxqqamitglhehaktgxm (PRODUCCIÓN)
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const SUPABASE_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const TEST_EMAIL = 'test.nuevo.admin.2026@gmail.com';

const h = {
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey': SERVICE_KEY,
  'Content-Type': 'application/json'
};

async function deleteTestUser() {
  console.log('🔍 Buscando usuario de prueba:', TEST_EMAIL);

  // 1. Buscar el usuario en auth.users
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: h });
  const listData = await listRes.json();
  const user = listData.users?.find(u => u.email === TEST_EMAIL);

  if (!user) {
    console.log('⚠️  Usuario no encontrado. Puede que ya fue eliminado.');
    return;
  }

  console.log('✅ Encontrado:', user.id, '| Email confirmado:', !!user.email_confirmed_at);

  // 2. Eliminar perfil de profiles (primero para evitar FK violation)
  console.log('\n🗑️  Eliminando perfil en profiles...');
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`,
    { method: 'DELETE', headers: h }
  );
  console.log('   profiles DELETE status:', profileRes.status);

  // 3. Eliminar de auth.users
  console.log('🗑️  Eliminando de auth.users...');
  const authRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
    { method: 'DELETE', headers: h }
  );
  const authData = await authRes.text();
  console.log('   auth.users DELETE status:', authRes.status, authData.substring(0, 100));

  // 4. Verificar que ya no existe
  console.log('\n🔎 Verificando eliminación...');
  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: h });
  const verifyData = await verifyRes.json();
  const stillExists = verifyData.users?.find(u => u.email === TEST_EMAIL);

  if (stillExists) {
    console.error('❌ ERROR: El usuario todavía existe. Revisar manualmente.');
  } else {
    console.log('✅ CONFIRMADO: Usuario de prueba eliminado exitosamente de producción.');
  }
}

deleteTestUser().catch(console.error);
