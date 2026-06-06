const { createClient } = require('@supabase/supabase-js');
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const supabase = createClient(URL, SERVICE_KEY);

async function run() {
  const { data: quotes, error } = await supabase
    .from('cotizaciones')
    .select('*')
    .eq('company_id', 'ee91c9f0-3e3a-44b6-8907-42a4af518f4b')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching quote:', error);
  } else {
    console.log('Latest Quote:', JSON.stringify(quotes[0], null, 2));
  }
}
run();
