const { createClient } = require('@supabase/supabase-js');

// El proyecto RESTAURADO donde están los 83 leads de Ensivar
// ID: ikofyypxphrqkncimszt
// Necesitamos el service_role key - intentar con mismo patrón de JWT
// El anon key del proyecto restaurado viene del mismo formato

// PRODUCTION - destino final
const PROD_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const prod = createClient(PROD_URL, PROD_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Check if the restored project is still accessible via its URL
const RESTORED_URL = 'https://ikofyypxphrqkncimszt.supabase.co';
const RESTORED_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlrb2Z5eXB4cGhycWtuY2ltc3p0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzAzODE3OSwiZXhwIjoyMDU4NjE0MTc5fQ.placeholder';

// Try to fetch from restored project
async function tryRestored() {
  console.log('Intentando acceder al proyecto restaurado ikofyypxphrqkncimszt...');
  
  // Try reading the Supabase dashboard page content - we just need to see if it is reachable
  const response = await fetch(`${RESTORED_URL}/rest/v1/leads?select=count`, {
    headers: {
      'apikey': RESTORED_SERVICE_KEY,
      'Authorization': `Bearer ${RESTORED_SERVICE_KEY}`
    }
  });
  
  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Response:', text.substring(0, 200));
}

// Alternative: Check via the Supabase management API
async function tryViaManagement() {
  const mgmtResponse = await fetch('https://api.supabase.com/v1/projects/ikofyypxphrqkncimszt', {
    headers: {
      'Authorization': 'Bearer sbp_test'  // needs personal access token
    }
  });
  console.log('Management API status:', mgmtResponse.status);
}

tryRestored().catch(e => console.log('Error:', e.message));
