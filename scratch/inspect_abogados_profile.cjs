const { createClient } = require('@supabase/supabase-js');
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';

const supabase = createClient(URL, SERVICE_KEY);

async function run() {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'admin@abogadosyasociados.com')
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
  } else {
    console.log('Profile:', JSON.stringify(profile, null, 2));
  }
}
run();
