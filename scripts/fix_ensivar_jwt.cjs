/**
 * FIX CRÍTICO: Actualizar app_metadata de usuarios Ensivar
 * El RLS usa get_auth_company_id() que lee del JWT app_metadata.
 * Sin este campo, los usuarios no pueden ver NADA en el sistema.
 */
const { createClient } = require('@supabase/supabase-js');

const PROD_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const supabase = createClient(PROD_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ENSIVAR_CID = 'ec88dff0-94a2-4544-ad2e-1f93a8163366';

// Ensivar user IDs confirmed from profiles table
const ENSIVAR_USERS = [
  { id: 'ffc70ef8-d352-499f-86bb-f74ad16ec432', email: 'jimmy@ensivar.com', role: 'company_admin' },
  { id: '4f16d44f-a580-4306-9ea7-9ec8992c7726', email: 'pmartinez@ensivar.com', role: 'company_admin' },
  { id: '2f9132d1-a249-4db7-b219-e3b47014eb57', email: 'melvin@ensivar.com', role: 'collaborator' },
];

async function fixEnsivarJWT() {
  console.log('=== FIX: Actualizando app_metadata de usuarios Ensivar ===\n');
  console.log(`Company ID de Ensivar: ${ENSIVAR_CID}\n`);

  // STEP 1: Verify current state of production leads (safety check)
  const { data: allLeads } = await supabase.from('leads').select('company_id');
  const ariasBefore = allLeads?.filter(l => l.company_id === '7a582ba5-f7d0-4ae3-9985-35788deb1c30').length;
  const ensivarBefore = allLeads?.filter(l => l.company_id === ENSIVAR_CID).length;
  console.log('PRE-FIX Estado de producción:');
  console.log(`  Arias Defense leads: ${ariasBefore} (NO SE TOCA)`);
  console.log(`  Ensivar leads en DB: ${ensivarBefore}`);
  console.log('');

  // STEP 2: Update app_metadata for each Ensivar user
  let successCount = 0;
  for (const user of ENSIVAR_USERS) {
    console.log(`Actualizando ${user.email}...`);
    
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: {
        company_id: ENSIVAR_CID,
        role: user.role
      }
    });

    if (error) {
      console.error(`  ❌ Error: ${error.message}`);
    } else {
      console.log(`  ✅ app_metadata actualizado correctamente`);
      console.log(`     company_id: ${data.user.app_metadata?.company_id}`);
      console.log(`     role: ${data.user.app_metadata?.role}`);
      successCount++;
    }
  }

  // STEP 3: Verify the fix - check get_auth_company_id returns correctly
  // We do this by checking that all profiles still align
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, company_id, role')
    .in('id', ENSIVAR_USERS.map(u => u.id));
  
  console.log('\nVerificación de perfiles post-fix:');
  profiles?.forEach(p => {
    const match = p.company_id === ENSIVAR_CID ? '✅' : '❌';
    console.log(`  ${match} ${p.email} → company_id: ${p.company_id}`);
  });

  // STEP 4: Final verification that Arias Defense data is untouched
  const { data: finalLeads } = await supabase.from('leads').select('company_id');
  const ariasAfter = finalLeads?.filter(l => l.company_id === '7a582ba5-f7d0-4ae3-9985-35788deb1c30').length;
  const ensivarAfter = finalLeads?.filter(l => l.company_id === ENSIVAR_CID).length;

  console.log('\n=== RESULTADO FINAL ===');
  console.log(`Usuarios Ensivar actualizados: ${successCount}/${ENSIVAR_USERS.length}`);
  console.log(`Arias Defense leads: ${ariasBefore} → ${ariasAfter} ${ariasBefore === ariasAfter ? '✅ INTACTO' : '🚨 CAMBIÓ!'}`);
  console.log(`Ensivar leads en DB: ${ensivarBefore} → ${ensivarAfter} ${(ensivarAfter || 0) > 0 ? '✅' : '❌'}`);
  
  if (successCount === ENSIVAR_USERS.length) {
    console.log('\n✅ FIX APLICADO. Los usuarios de Ensivar deben hacer logout/login para obtener el nuevo JWT con company_id.');
    console.log('\nInstrucciones para Ensivar:');
    console.log('  1. Cerrar sesión en el CRM');
    console.log('  2. Volver a iniciar sesión');
    console.log('  3. Los leads deberían aparecer inmediatamente');
  } else {
    console.log('\n⚠️  Algunos usuarios no se pudieron actualizar. Revisar errores arriba.');
  }
}

fixEnsivarJWT().catch(console.error);
