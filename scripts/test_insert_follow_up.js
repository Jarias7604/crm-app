// Test inserting a follow_up with null lead_id using service_role key to verify constraint removal
const TARGET_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

async function test() {
  console.log('Testing follow_ups insert with null lead_id...');
  const res = await fetch(`${TARGET_URL}/rest/v1/follow_ups`, {
    method: 'POST',
    headers: {
      'apikey': TARGET_KEY,
      'Authorization': `Bearer ${TARGET_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      company_id: '7a582ba5-f7d0-4ae3-9985-35788deb1c30', // Trial company
      lead_id: null,
      notes: 'Test leadless follow-up from verification script',
      action_type: 'meeting',
      date: new Date().toISOString()
    })
  });

  if (res.ok) {
    const data = await res.json();
    console.log('✅ Success! Inserted row:', data);
    
    // Clean up the test row
    if (data && data[0] && data[0].id) {
      console.log('Cleaning up test row...');
      await fetch(`${TARGET_URL}/rest/v1/follow_ups?id=eq.${data[0].id}`, {
        method: 'DELETE',
        headers: {
          'apikey': TARGET_KEY,
          'Authorization': `Bearer ${TARGET_KEY}`
        }
      });
      console.log('Cleanup complete.');
    }
  } else {
    const errText = await res.text();
    console.error('❌ Insert failed:', res.status, errText);
  }
}

test();
