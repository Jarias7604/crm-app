// Fetch all follow_ups of type 'meeting' for the Trial company
const TARGET_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTnliklkjlsdf'; // We need the correct service key from our files
const ACTUAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

async function listMeetings() {
  console.log('Searching for meetings for company 7a582ba5-f7d0-4ae3-9985-35788deb1c30...');
  
  const res = await fetch(`${TARGET_URL}/rest/v1/follow_ups?company_id=eq.7a582ba5-f7d0-4ae3-9985-35788deb1c30&action_type=eq.meeting`, {
    headers: {
      'apikey': ACTUAL_KEY,
      'Authorization': `Bearer ${ACTUAL_KEY}`
    }
  });

  if (res.ok) {
    const data = await res.json();
    console.log(`Found ${data.length} meetings:`);
    data.forEach(item => {
      console.log(`ID: ${item.id}, Date: ${item.date}, Notes: ${item.notes}, Lead ID: ${item.lead_id}`);
    });
  } else {
    console.error('Fetch failed:', await res.text());
  }
}

listMeetings();
