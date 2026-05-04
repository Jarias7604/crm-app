/**
 * MIGRATE TICKETS: Old project (ikofyyp) → Production (mtxqqam)
 * 
 * Steps:
 * 1. Delete DEMO/test tickets from production
 * 2. Delete duplicate categories from production
 * 3. Insert real categories from backup
 * 4. Insert 90 real tickets from backup
 */
import { readFileSync } from 'fs';

const PROD_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const PROD_SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const headers = {
  'apikey': PROD_SK,
  'Authorization': `Bearer ${PROD_SK}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

async function query(endpoint, options = {}) {
  const r = await fetch(`${PROD_URL}/rest/v1/${endpoint}`, { headers, ...options });
  if (!r.ok) {
    const body = await r.text();
    console.error(`  ERROR ${r.status}: ${body}`);
    return null;
  }
  if (options.method && options.method !== 'GET') return 'ok';
  return r.json();
}

async function main() {
  console.log('=== TICKET MIGRATION: Old Project → Production ===\n');

  // Step 1: Check current production state
  console.log('STEP 1: Current production state');
  const currentTickets = await fetch(`${PROD_URL}/rest/v1/tickets?select=id,title&order=created_at`, { headers }).then(r => r.json());
  const currentCats = await fetch(`${PROD_URL}/rest/v1/ticket_categories?select=id,name,company_id`, { headers }).then(r => r.json());
  console.log(`  Current tickets: ${currentTickets.length}`);
  console.log(`  Current categories: ${currentCats.length}`);

  // Step 2: Delete ALL existing tickets (DEMO + test + old real ones)
  console.log('\nSTEP 2: Deleting ALL existing tickets from production...');
  const delTickets = await fetch(`${PROD_URL}/rest/v1/tickets?id=not.is.null`, { 
    headers: { ...headers, 'Prefer': 'return=minimal' }, 
    method: 'DELETE' 
  });
  console.log(`  Delete tickets: ${delTickets.status} ${delTickets.ok ? '✅' : '❌'}`);

  // Step 3: Delete ALL existing categories
  console.log('\nSTEP 3: Deleting ALL existing categories...');
  const delCats = await fetch(`${PROD_URL}/rest/v1/ticket_categories?id=not.is.null`, { 
    headers: { ...headers, 'Prefer': 'return=minimal' }, 
    method: 'DELETE' 
  });
  console.log(`  Delete categories: ${delCats.status} ${delCats.ok ? '✅' : '❌'}`);

  // Step 4: Insert real categories from backup
  console.log('\nSTEP 4: Inserting 6 real categories...');
  const cats = JSON.parse(readFileSync('scripts/ticket_categories_backup.json', 'utf8'));
  const catInsert = await fetch(`${PROD_URL}/rest/v1/ticket_categories`, {
    headers: { ...headers, 'Prefer': 'return=representation' },
    method: 'POST',
    body: JSON.stringify(cats.map(c => ({
      id: c.id,
      company_id: c.company_id,
      name: c.name,
      description: c.description,
      color: c.color,
      sla_hours: c.sla_hours,
      created_at: c.created_at
    })))
  });
  const insertedCats = await catInsert.json();
  console.log(`  Insert categories: ${catInsert.status} - ${Array.isArray(insertedCats) ? insertedCats.length + ' inserted ✅' : 'ERROR ❌'}`);
  if (!Array.isArray(insertedCats)) console.log('  ', JSON.stringify(insertedCats).slice(0, 300));

  // Step 5: Insert 90 real tickets from backup (in batches of 30)
  console.log('\nSTEP 5: Inserting 90 real tickets...');
  const tickets = JSON.parse(readFileSync('scripts/tickets_backup.json', 'utf8'));
  
  const BATCH = 30;
  let inserted = 0;
  let failed = 0;
  
  for (let i = 0; i < tickets.length; i += BATCH) {
    const batch = tickets.slice(i, i + BATCH);
    const payload = batch.map(t => ({
      id: t.id,
      company_id: t.company_id,
      lead_id: t.lead_id,
      category_id: t.category_id,
      assigned_to: t.assigned_to,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      metadata: t.metadata,
      last_status_change_at: t.last_status_change_at,
      resolved_at: t.resolved_at,
      created_at: t.created_at,
      updated_at: t.updated_at,
      created_by: t.created_by,
      due_date: t.due_date,
      lead_name: t.lead_name
    }));

    const r = await fetch(`${PROD_URL}/rest/v1/tickets`, {
      headers: { ...headers, 'Prefer': 'return=minimal' },
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    if (r.ok) {
      inserted += batch.length;
      console.log(`  Batch ${Math.floor(i/BATCH)+1}: ${batch.length} tickets ✅`);
    } else {
      const err = await r.text();
      console.error(`  Batch ${Math.floor(i/BATCH)+1}: FAILED - ${err.slice(0, 200)}`);
      failed += batch.length;
      
      // Try one by one for failed batch
      for (const t of batch) {
        const r2 = await fetch(`${PROD_URL}/rest/v1/tickets`, {
          headers: { ...headers, 'Prefer': 'return=minimal' },
          method: 'POST',
          body: JSON.stringify({
            id: t.id, company_id: t.company_id, lead_id: t.lead_id,
            category_id: t.category_id, assigned_to: t.assigned_to,
            title: t.title, description: t.description,
            status: t.status, priority: t.priority,
            metadata: t.metadata, last_status_change_at: t.last_status_change_at,
            resolved_at: t.resolved_at, created_at: t.created_at,
            updated_at: t.updated_at, created_by: t.created_by,
            due_date: t.due_date, lead_name: t.lead_name
          })
        });
        if (r2.ok) { inserted++; failed--; }
        else { 
          const e = await r2.text();
          console.error(`    ❌ "${t.title}": ${e.slice(0,150)}`);
        }
      }
    }
  }

  console.log(`\n  Total inserted: ${inserted}/${tickets.length}`);
  if (failed > 0) console.log(`  Failed: ${failed}`);

  // Step 6: Verify
  console.log('\nSTEP 6: Verification...');
  const finalTickets = await fetch(`${PROD_URL}/rest/v1/tickets?select=id&order=created_at`, { 
    headers: { ...headers, 'Prefer': 'count=exact' }
  });
  console.log(`  Content-Range: ${finalTickets.headers.get('content-range')}`);
  const finalCats = await fetch(`${PROD_URL}/rest/v1/ticket_categories?select=id`, { 
    headers: { ...headers, 'Prefer': 'count=exact' }
  });
  console.log(`  Categories Range: ${finalCats.headers.get('content-range')}`);
  
  console.log('\n✅ MIGRATION COMPLETE!');
}

main().catch(console.error);
