const { createClient } = require('@supabase/supabase-js');
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';

const supabase = createClient(URL, SERVICE_KEY);

async function run() {
  const companyId = 'ee91c9f0-3e3a-44b6-8907-42a4af518f4b';

  const { data: items, error } = await supabase
    .from('cotizador_items')
    .select('*')
    .eq('company_id', companyId);

  if (error) {
    console.error('Error fetching cotizador_items:', error);
    return;
  }

  console.log('cotizador_items for Abogados:', JSON.stringify(items, null, 2));
}
run();
