const { createClient } = require('@supabase/supabase-js');

// PROYECTO RESTAURADO - donde estaban los 83 leads de Ensivar
const RESTORED_URL = 'https://ikofyypxphrqkncimszt.supabase.co';
// SERVICE ROLE KEY for the restored project - need to try with the same pattern
// From conversation logs, this was the "Jarias7604's Project" restored by Supabase

// PRODUCTION - current production
const PROD_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const prod = createClient(PROD_URL, PROD_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function check() {
  // Step 1: Verify current state of production - count by company
  const { data: allLeads } = await prod.from('leads').select('company_id');
  const counts = {};
  allLeads?.forEach(l => { counts[l.company_id] = (counts[l.company_id] || 0) + 1; });
  
  console.log('ESTADO ACTUAL DE PRODUCCION:');
  console.log('  Total leads:', allLeads?.length);
  Object.entries(counts).forEach(([cid, cnt]) => console.log(`  ${cid}: ${cnt}`));
  
  // Step 2: Get companies to confirm names
  const { data: companies } = await prod.from('companies').select('id, name');
  console.log('\nCompanies:');
  companies?.forEach(c => console.log(`  ${c.id}: ${c.name}`));
  
  // The Ensivar company_id in PRODUCTION
  const ENSIVAR_PROD_CID = 'ec88dff0-94a2-4544-ad2e-1f93a8163366';
  console.log('\nEnsivar company_id in production:', ENSIVAR_PROD_CID);
  console.log('Leads under Ensivar in production:', counts[ENSIVAR_PROD_CID] ?? 0);
}

check();
