const { createClient } = require('@supabase/supabase-js');
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';

const supabase = createClient(URL, SERVICE_KEY);

async function run() {
  const { data: plans, error } = await supabase
    .from('financing_plans')
    .select('*');

  if (error) {
    console.error('Error fetching financing plans:', error);
  } else {
    console.log('Total plans found:', plans.length);
    plans.forEach(p => {
      console.log(`- ID: ${p.id}, Title: ${p.titulo}, CompanyID: ${p.company_id}, Active: ${p.activo}`);
    });
  }
}
run();
