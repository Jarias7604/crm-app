const { createClient } = require('@supabase/supabase-js');
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const supabase = createClient(URL, SERVICE_KEY);

async function run() {
  const { data, error } = await supabase.auth.admin.updateUserById(
    '18492d1d-e909-4d96-9de1-eff73e12d751',
    { password: 'AbogadosCRM2026!' }
  );

  if (error) {
    console.error('Error updating password:', error);
  } else {
    console.log('Password updated successfully for admin@abogadosyasociados.com');
  }
}
run();
