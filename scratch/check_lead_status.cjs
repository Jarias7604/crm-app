const { createClient } = require('@supabase/supabase-js');
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const supabase = createClient(URL, SERVICE_KEY);

async function run() {
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, name, company_name, company_id');

  if (error) {
    console.error('Error fetching leads:', error);
    return;
  }

  const counts = {};
  leads.forEach(l => {
    counts[l.company_id] = (counts[l.company_id] || 0) + 1;
  });
  console.log('Lead counts by company_id:', counts);

  const abogadosLeads = leads.filter(l => l.company_id === 'ee91c9f0-3e3a-44b6-8907-42a4af518f4b');
  console.log('Abogados leads:', abogadosLeads.map(l => ({ id: l.id, name: l.name, company_name: l.company_name })));
}
run();
