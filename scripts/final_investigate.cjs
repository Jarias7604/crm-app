const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mtxqqamitglhehaktgxm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function investigate() {
  console.log('=== INVESTIGACION FINAL ===\n');

  // The old Ensivar company_id seen in the conversation logs was e07ae4b9...
  // Check if that ID exists in companies table
  const { data: allCompanies } = await supabase.from('companies').select('*');
  console.log('ALL companies in DB:');
  allCompanies?.forEach(c => console.log(`  ID: ${c.id} | Name: ${c.name}`));

  // Check if the old ID e07ae4b9 appears ANYWHERE in leads
  console.log('\n\nChecking if old Ensivar ID (e07ae4b9...) has any leads...');
  const { data: oldIdLeads, count: oldCount } = await supabase
    .from('leads')
    .select('id, name, company_id, created_at', { count: 'exact' })
    .ilike('company_id::text', 'e07ae4b9%');
  console.log('Leads with e07ae4b9... company_id:', oldCount ?? oldIdLeads?.length ?? 0);

  // Get ALL distinct company_ids in leads table  
  console.log('\nALL distinct company_ids in leads table:');
  const { data: allLeads } = await supabase.from('leads').select('company_id');
  const uniqueCids = [...new Set(allLeads?.map(l => l.company_id))];
  uniqueCids.forEach(cid => {
    const count = allLeads?.filter(l => l.company_id === cid).length;
    console.log(`  ${cid}: ${count} leads`);
  });

  // Check what Ensivar company_id was BEFORE - look in profiles for discrepancy
  console.log('\nAll profile company_ids:');
  const { data: profiles } = await supabase.from('profiles').select('email, company_id');
  const uniquePCids = [...new Set(profiles?.map(p => p.company_id))];
  uniquePCids.forEach(cid => {
    const users = profiles?.filter(p => p.company_id === cid).map(p => p.email);
    console.log(`  ${cid}: [${users?.join(', ')}]`);
  });

  // The big question: does Ensivar company record match profiles?
  const ENSIVAR_IN_COMPANIES = 'ec88dff0-94a2-4544-ad2e-1f93a8163366';
  const ensivarProfiles = profiles?.filter(p => p.company_id === ENSIVAR_IN_COMPANIES);
  console.log(`\nEnsivar profiles using ec88dff0: ${ensivarProfiles?.length}`);

  // Look for ANY leads created between April 9-22 (when Ensivar was active before RLS fix)
  console.log('\nLeads created between April 9-22 (Ensivar active period):');
  const { data: aprilLeads } = await supabase
    .from('leads')
    .select('id, name, company_id, created_at, assigned_to')
    .gte('created_at', '2026-04-09T00:00:00Z')
    .lte('created_at', '2026-04-22T23:59:59Z')
    .order('created_at', { ascending: true });
  
  console.log(`Total in that period: ${aprilLeads?.length}`);
  aprilLeads?.forEach(l => console.log(`  [${l.created_at.substring(0,10)}] ${l.name} | company_id: ${l.company_id}`));
}

investigate().catch(console.error);
