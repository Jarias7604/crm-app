const { createClient } = require('@supabase/supabase-js');

const PROD_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const prod = createClient(PROD_URL, PROD_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const ENSIVAR_PROD_CID = 'ec88dff0-94a2-4544-ad2e-1f93a8163366';
const ARIAS_CID = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';

async function verify() {
  const { data, error } = await prod.from('leads').select('company_id');
  if (error) { console.error(error); return; }
  
  const ensivar = data.filter(l => l.company_id === ENSIVAR_PROD_CID).length;
  const arias = data.filter(l => l.company_id === ARIAS_CID).length;
  
  console.log('Estado actual de producción:');
  console.log('  Arias Defense:', arias);
  console.log('  Ensivar:', ensivar);
  console.log('  Total:', data.length);
}

verify();
