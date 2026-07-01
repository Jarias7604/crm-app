// Verification script: checks the policies on teams and follow_ups tables in production using service_role key
const TARGET_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

async function verify() {
  console.log('Verifying active RLS policies in production...');

  // Since we cannot run custom DDL queries easily via PostgREST, we can call the management API to run a select query
  // Wait! The project ref is mtxqqamitglhehaktgxm. The management API endpoint is:
  // https://api.supabase.com/v1/projects/mtxqqamitglhehaktgxm/database/query
  // Wait, does the service role key work as a Bearer token for the Management API?
  // Let's test calling the query endpoint using the service key
  const query = `
    SELECT policyname, cmd 
    FROM pg_policies 
    WHERE tablename IN ('teams', 'follow_ups') 
    ORDER BY tablename, cmd;
  `;

  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/mtxqqamitglhehaktgxm/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TARGET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (res.ok) {
      const data = await res.json();
      console.log('✅ Query succeeded. Policies found:', data);
    } else {
      const text = await res.text();
      console.error(`❌ Query failed (${res.status}):`, text.substring(0, 300));
    }
  } catch (e) {
    console.error('Network error during verification:', e.message);
  }
}

verify();
