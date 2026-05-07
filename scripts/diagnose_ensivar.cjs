const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mtxqqamitglhehaktgxm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  // Check if there are leads with the Ensivar user IDs in assigned_to
  const ENSIVAR_USERS = [
    'ffc70ef8-d352-499f-86bb-f74ad16ec432',  // jimmy@ensivar.com
    '4f16d44f-a580-4306-9ea7-9ec8992c7726',  // pmartinez@ensivar.com
    '2f9132d1-a249-4db7-b219-e3b47014eb57',  // melvin@ensivar.com
  ];
  
  // Check all leads, ignoring company_id filter (service role bypasses RLS)
  const { data: allLeads, count } = await supabase
    .from('leads')
    .select('id, name, company_id, assigned_to, created_at', { count: 'exact' });
  
  console.log(`Total leads in DB (no RLS filter): ${count}`);
  
  // Breakdown by company_id
  const groups = {};
  allLeads.forEach(l => {
    groups[l.company_id] = (groups[l.company_id] || 0) + 1;
  });
  console.log('\nLeads by company_id:');
  Object.entries(groups).forEach(([cid, cnt]) => console.log(`  ${cid}: ${cnt}`));
  
  // Check if any leads were created AFTER the RLS fix (April 22) under Ensivar
  const ENSIVAR_CID = 'ec88dff0-94a2-4544-ad2e-1f93a8163366';
  const afterApril22 = allLeads.filter(l => 
    new Date(l.created_at) > new Date('2026-04-22') && l.company_id === ENSIVAR_CID
  );
  console.log(`\nEnsivar leads created after April 22: ${afterApril22.length}`);
  
  // What leads exist from Arias Defense after April 22 (these may be ones that "should" be Ensivar)
  const ariasAfterApril22 = allLeads.filter(l =>
    new Date(l.created_at) > new Date('2026-04-09') && // Ensivar account created April 9
    l.company_id === '7a582ba5-f7d0-4ae3-9985-35788deb1c30'
  );
  console.log(`Arias Defense leads created after April 9 (Ensivar account creation): ${ariasAfterApril22.length}`);
  
  // Check if any of these were assigned to Ensivar user IDs
  const suspectedEnsivar = allLeads.filter(l => ENSIVAR_USERS.includes(l.assigned_to));
  console.log(`\nLeads assigned to an Ensivar user: ${suspectedEnsivar.length}`);
  
  // Check the marketing_conversations table - Ensivar should have WhatsApp convos
  const { data: convos, error: convErr } = await supabase
    .from('marketing_conversations')
    .select('id, company_id, lead_id, contact_phone')
    .eq('company_id', ENSIVAR_CID);
  
  if (convErr) console.error('Conv error:', convErr.message);
  else console.log(`\nEnsivar marketing_conversations: ${convos?.length || 0}`);
}

diagnose();
