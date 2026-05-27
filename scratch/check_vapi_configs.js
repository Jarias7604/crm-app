const TARGET_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

async function run() {
  console.log("Fetching companies in Production DB...");
  const res = await fetch(`${TARGET_URL}/rest/v1/companies?select=id,name,features`, {
    headers: {
      'apikey': TARGET_KEY,
      'Authorization': `Bearer ${TARGET_KEY}`
    }
  });
  if (!res.ok) {
    console.error("Failed:", await res.text());
    return;
  }
  const companies = await res.json();
  for (const c of companies) {
    console.log(`\n===================================`);
    console.log(`Company Name: ${c.name} (${c.id})`);
    console.log(`Features Config:`, JSON.stringify(c.features || {}, null, 2));
  }
}
run().catch(console.error);
