// Fix directo via Supabase Management API v1
// Elimina la función duplicada provision_new_tenant con jsonb

const MGMT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const PROJECT_REF = 'mtxqqamitglhehaktgxm';

// SQL a ejecutar
const SQL = `
DROP FUNCTION IF EXISTS public.provision_new_tenant(
  p_company_name text,
  p_license_status text,
  p_rnc text,
  p_telefono text,
  p_email text,
  p_direccion text,
  p_max_users integer,
  p_allowed_permissions jsonb,
  p_admin_email text,
  p_admin_password text,
  p_admin_full_name text
);

-- Verificar que solo queda una versión
SELECT proname, pg_get_function_arguments(oid) as args
FROM pg_proc
WHERE proname = 'provision_new_tenant'
  AND pronamespace = 'public'::regnamespace;
`;

async function applyFix() {
  console.log('🔧 Aplicando fix via Supabase Management API...');
  
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MGMT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: SQL })
    }
  );

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text.substring(0, 500));

  if (res.status === 200 || res.status === 201) {
    console.log('✅ Fix aplicado exitosamente!');
  } else {
    console.log('\n⚠️  Management API no funcionó con service_role token.');
    console.log('   El fix requiere el MANAGEMENT TOKEN personal de Supabase.');
    console.log('\n   Por favor ejecuta este SQL en el Dashboard de Supabase:');
    console.log('   https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql/new');
    console.log('\n   SQL:');
    console.log('   ─────────────────────────────────────────────────────');
    console.log('   DROP FUNCTION IF EXISTS public.provision_new_tenant(');
    console.log('     text, text, text, text, text, text, integer, jsonb, text, text, text');
    console.log('   );');
    console.log('   ─────────────────────────────────────────────────────');
  }
}

applyFix().catch(console.error);
