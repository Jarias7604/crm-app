// Fetch all follow_ups in June 2026 for company '7a582ba5-f7d0-4ae3-9985-35788deb1c30' (or any company) to see if there are any meetings on June 18th
const TARGET_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

async function listFollowUps() {
  console.log('Fetching all follow-ups for June 2026...');
  // June 2026 is 2026-06-01 to 2026-06-30
  const res = await fetch(`${TARGET_URL}/rest/v1/follow_ups?date=gte.2026-06-01T00:00:00.000Z&date=lte.2026-06-30T23:59:59.999Z`, {
    headers: {
      'apikey': TARGET_KEY,
      'Authorization': `Bearer ${TARGET_KEY}`
    }
  });

  if (res.ok) {
    const data = await res.json();
    console.log(`Found ${data.length} follow-ups in June 2026:`);
    data.forEach(item => {
      console.log(`- Date: ${item.date}, Notes: ${item.notes}, Lead ID: ${item.lead_id}, Company ID: ${item.company_id}, Action: ${item.action_type}`);
    });
  } else {
    console.error('Failed to fetch:', await res.text());
  }
}

listFollowUps();
