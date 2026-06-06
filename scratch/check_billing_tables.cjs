const { createClient } = require('@supabase/supabase-js');
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const supabase = createClient(URL, SERVICE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('get_auth_role'); // Let's try executing query or look at table listing via some standard table
  // Let's do a select from pg_catalog if allowed, or see if we can do it via a simple SELECT from invoices
  const { data: dataInv, error: errorInv } = await supabase.from('invoices').select('*').limit(1);
  console.log('invoices:', { count: dataInv?.length, error: errorInv });

  const { data: dataFact, error: errorFact } = await supabase.from('facturas').select('*').limit(1);
  console.log('facturas:', { count: dataFact?.length, error: errorFact });
}
run();
