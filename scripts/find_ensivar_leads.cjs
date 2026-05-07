const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mtxqqamitglhehaktgxm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const supabase = createClient(supabaseUrl, supabaseKey);

// Ensivar user IDs from the profiles query
const ENSIVAR_USER_IDS = [
  'ffc70ef8-d352-499f-86bb-f74ad16ec432',  // jimmy@ensivar.com
  '4f16d44f-a580-4306-9ea7-9ec8992c7726',  // pmartinez@ensivar.com
];

const ENSIVAR_COMPANY_ID = 'ec88dff0-94a2-4544-ad2e-1f93a8163366';

async function findEnsivarLeads() {
  console.log('Looking for leads assigned to Ensivar users (assigned_to field)...');
  
  // Leads assigned to Ensivar users
  const { data: assignedLeads, error: assignErr } = await supabase
    .from('leads')
    .select('id, name, company_name, status, assigned_to, created_at, company_id')
    .in('assigned_to', ENSIVAR_USER_IDS);

  if (assignErr) {
    console.error('Error:', assignErr);
  } else {
    console.log(`\nLeads assigned to Ensivar users: ${assignedLeads.length}`);
    assignedLeads.forEach(l => {
      const user = l.assigned_to === 'ffc70ef8-d352-499f-86bb-f74ad16ec432' ? 'Jimmy (Ensivar)' : 'Patty (Ensivar)';
      console.log(`  [${l.status}] ${l.name} | assigned_to: ${user} | current company_id: ${l.company_id}`);
    });
  }

  // Check the follow_ups table to find leads created by Ensivar users
  console.log('\nChecking follow_ups created by Ensivar users...');
  const { data: followUps, error: fuErr } = await supabase
    .from('follow_ups')
    .select('lead_id, created_by')
    .in('created_by', ENSIVAR_USER_IDS);
    
  if (!fuErr && followUps) {
    const uniqueLeadIds = [...new Set(followUps.map(f => f.lead_id))];
    console.log(`Follow-ups by Ensivar users touch ${uniqueLeadIds.length} unique leads`);
    
    if (uniqueLeadIds.length > 0) {
      const { data: fuLeads, error: flErr } = await supabase
        .from('leads')
        .select('id, name, company_name, status, company_id, created_at')
        .in('id', uniqueLeadIds);
        
      if (!flErr) {
        console.log('\nThose leads:');
        fuLeads.forEach(l => console.log(`  [${l.status}] ${l.name} | company_id: ${l.company_id}`));
      }
    }
  }
  
  // Also check cotizaciones created by Ensivar users
  console.log('\nChecking cotizaciones created by Ensivar users...');
  const { data: cots, error: cotErr } = await supabase
    .from('cotizaciones')
    .select('lead_id, created_by, company_id')
    .in('created_by', ENSIVAR_USER_IDS);
    
  if (!cotErr && cots) {
    console.log(`Cotizaciones by Ensivar users: ${cots.length}`);
    const uniqueLeadIds = [...new Set(cots.map(c => c.lead_id).filter(Boolean))];
    console.log(`Touching ${uniqueLeadIds.length} unique leads`);
  }
}

findEnsivarLeads();
