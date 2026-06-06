const { createClient } = require('@supabase/supabase-js');
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';

const supabase = createClient(URL, SERVICE_KEY);

async function run() {
  const { data: plans, error } = await supabase
    .from('financing_plans')
    .select('*')
    .eq('company_id', '7a582ba5-f7d0-4ae3-9985-35788deb1c30')
    .eq('activo', true);

  if (error) {
    console.error('Error fetching plans:', error);
  } else {
    console.log('Active plans for Arias:', JSON.stringify(plans, null, 2));
  }
}
run();
