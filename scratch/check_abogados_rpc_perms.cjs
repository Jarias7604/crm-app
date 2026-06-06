const { createClient } = require('@supabase/supabase-js');
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';

const supabase = createClient(URL, SERVICE_KEY);

async function run() {
  const { data: perms, error } = await supabase.rpc('get_user_permissions', {
    user_id: '18492d1d-e909-4d96-9de1-eff73e12d751'
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Returned Permissions:', perms);
  }
}
run();
