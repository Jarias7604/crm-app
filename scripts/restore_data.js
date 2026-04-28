import { readFileSync } from 'fs';

const TARGET_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const BASE = 'C:/Users/jaria/.gemini/antigravity/brain/382da9af-f028-4773-a4d0-253d227a96eb/.system_generated/steps';

const IMPORTS = [
  { step: '235', table: 'leads' },
  { step: '239', table: 'leads' },
  { step: '240', table: 'leads' },
  { step: '241', table: 'leads' },
  { step: '242', table: 'leads' },
  { step: '243', table: 'follow_ups' },
  { step: '244', table: 'loss_reasons' },
  { step: '245', table: 'call_activities' },
];

function extractJSON(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  
  // The file is a JSON object: {"result":"..."}
  // The result string contains escaped JSON with \\\" for quotes
  // We need to find the json_agg array inside
  
  // Step 1: Parse the outer JSON
  const outer = JSON.parse(raw);
  const resultStr = outer.result;
  
  // Step 2: Find the json_agg value within the result string
  // The format is: ...[{"json_agg":[{actual data},...]}]...
  const startMarker = '"json_agg":';
  const idx = resultStr.indexOf(startMarker);
  if (idx === -1) {
    console.log('  ❌ No json_agg found');
    return null;
  }
  
  // Find the start of the array after "json_agg":
  const arrayStart = resultStr.indexOf('[', idx + startMarker.length);
  if (arrayStart === -1) return null;
  
  // Find the matching end bracket - track bracket depth
  let depth = 0;
  let arrayEnd = -1;
  for (let i = arrayStart; i < resultStr.length; i++) {
    if (resultStr[i] === '[') depth++;
    else if (resultStr[i] === ']') {
      depth--;
      if (depth === 0) {
        arrayEnd = i;
        break;
      }
    }
  }
  
  if (arrayEnd === -1) {
    console.log('  ❌ Could not find end of array');
    return null;
  }
  
  const jsonStr = resultStr.substring(arrayStart, arrayEnd + 1);
  return JSON.parse(jsonStr);
}

async function postBatch(table, rows) {
  const cleaned = rows.map(r => {
    const c = {...r};
    delete c.meta_adset_id;
    return c;
  });
  
  let total = 0;
  for (let i = 0; i < cleaned.length; i += 50) {
    const batch = cleaned.slice(i, i + 50);
    const res = await fetch(`${TARGET_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': TARGET_KEY,
        'Authorization': `Bearer ${TARGET_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates,return=minimal'
      },
      body: JSON.stringify(batch)
    });
    
    if (res.ok) {
      total += batch.length;
    } else {
      const err = await res.text();
      console.log(`    ⚠️ Batch error: ${err.substring(0, 200)}`);
      let ok = 0;
      for (const row of batch) {
        const c = {...row};
        delete c.meta_adset_id;
        const r2 = await fetch(`${TARGET_URL}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            'apikey': TARGET_KEY,
            'Authorization': `Bearer ${TARGET_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=ignore-duplicates,return=minimal'
          },
          body: JSON.stringify(c)
        });
        if (r2.ok) ok++;
      }
      total += ok;
      console.log(`    ✅ Row-by-row: ${ok}/${batch.length}`);
    }
  }
  return total;
}

async function main() {
  console.log('🚨 RESTORING PRODUCTION DATA');
  console.log(`   Target: mtxqqamitglhehaktgxm\n`);
  
  const totals = {};
  
  for (const { step, table } of IMPORTS) {
    const filePath = `${BASE}/${step}/output.txt`;
    console.log(`📦 Step ${step} → ${table}`);
    
    try {
      const data = extractJSON(filePath);
      if (!data || data.length === 0) {
        console.log(`  ⏭️ Empty or null`);
        continue;
      }
      console.log(`  📊 ${data.length} rows found`);
      const inserted = await postBatch(table, data);
      totals[table] = (totals[table] || 0) + inserted;
      console.log(`  ✅ ${inserted}/${data.length} inserted`);
    } catch(e) {
      console.log(`  ❌ ${e.message}`);
    }
  }
  
  console.log('\n📊 FINAL TOTALS:');
  for (const [t, c] of Object.entries(totals)) {
    console.log(`   ${t}: ${c} rows`);
  }
  
  // Verify counts
  console.log('\n🔍 VERIFICATION:');
  for (const table of ['leads', 'follow_ups', 'loss_reasons', 'cotizaciones', 'call_activities', 'clients']) {
    const res = await fetch(`${TARGET_URL}/rest/v1/${table}?select=id&limit=1`, {
      method: 'HEAD',
      headers: {
        'apikey': TARGET_KEY,
        'Authorization': `Bearer ${TARGET_KEY}`,
        'Prefer': 'count=exact'
      }
    });
    const count = res.headers.get('content-range');
    console.log(`   ${table}: ${count}`);
  }
}

main().catch(console.error);
