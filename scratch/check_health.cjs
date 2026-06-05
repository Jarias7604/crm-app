const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';

const h = { 
  'Authorization': `Bearer ${SERVICE_KEY}`, 
  'apikey': SERVICE_KEY, 
  'Content-Type': 'application/json' 
};

async function checkHealth() {
  try {
    const response = await fetch(`${URL}/rest/v1/rpc/crm_rls_health_check`, {
      method: 'POST',
      headers: h,
      body: '{}'
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Health Check Results:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error running health check:', error);
  }
}

checkHealth();
