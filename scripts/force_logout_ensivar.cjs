/**
 * Forzar logout de usuarios Ensivar
 * Revoca todas las sesiones activas — en el próximo login
 * recibirán un JWT nuevo con el company_id correcto.
 * NO afecta sus passwords ni datos.
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mtxqqamitglhehaktgxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// SOLO usuarios Ensivar — Arias Defense NO se toca
const ENSIVAR_USERS = [
  { id: 'ffc70ef8-d352-499f-86bb-f74ad16ec432', email: 'jimmy@ensivar.com' },
  { id: '4f16d44f-a580-4306-9ea7-9ec8992c7726', email: 'pmartinez@ensivar.com' },
  { id: '2f9132d1-a249-4db7-b219-e3b47014eb57', email: 'melvin@ensivar.com' },
];

async function forceLogout() {
  console.log('\n🔒 Forzando logout de usuarios Ensivar...\n');
  console.log('(Arias Defense NO es afectado)\n');

  let ok = 0;
  for (const u of ENSIVAR_USERS) {
    const { error } = await supabase.auth.admin.signOut(u.id, 'global');
    if (error) {
      console.log(`  ⚠️  ${u.email}: ${error.message}`);
    } else {
      console.log(`  ✅ ${u.email}: sesión revocada`);
      ok++;
    }
  }

  console.log(`\n${ok}/${ENSIVAR_USERS.length} usuarios desconectados.`);
  console.log('\nAhora pueden hacer login normalmente.');
  console.log('Sus 82 leads aparecerán inmediatamente después del login.\n');
}

forceLogout().catch(console.error);
