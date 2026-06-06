const { createClient } = require('@supabase/supabase-js');
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const supabase = createClient(URL, SERVICE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('get_function_def', { function_name: 'accept_quote_public' });
  if (error) {
    // If helper not present, query pg_proc directly using a raw SQL if possible, or another query.
    // Let's write a generic SQL query execution script.
    console.error('Error:', error);
  } else {
    console.log('Definition:', data);
  }
}

async function queryPgProc() {
  const { data, error } = await supabase.from('cotizaciones').select('id').limit(1);
  console.log('Query test:', { data, error });
}
run();
