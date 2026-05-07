const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mtxqqamitglhehaktgxm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCompanies() {
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name');
    
  console.log("Companies:", companies);
  
  const { data: tenants, error: tErr } = await supabase
    .from('tenants')
    .select('id, name');
  if (tErr) console.error("Tenants err:", tErr);
  else console.log("Tenants:", tenants);

  const { data: profiles, error: pErr } = await supabase
    .from('users')
    .select('*');
  if (pErr) console.error("Users err:", pErr);
  else console.log("Users:", profiles);
}

checkCompanies();
