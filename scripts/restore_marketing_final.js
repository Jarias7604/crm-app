import { readFileSync } from 'fs';

const TARGET_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const BASE = 'C:/Users/jaria/.gemini/antigravity/brain/382da9af-f028-4773-a4d0-253d227a96eb/.system_generated/steps';

const IMPORTS = [
  { step: '579', table: 'marketing_ai_agents' },
  { step: '582', table: 'marketing_campaigns' },
  { step: '585', table: 'marketing_conversations' },
  { step: '589', table: 'marketing_messages' }
];

function extractJSON(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  
  const outer = JSON.parse(raw);
  const resultStr = outer.result;
  
  const startMarker = '"json_agg":';
  const idx = resultStr.indexOf(startMarker);
  if (idx === -1) {
    console.log('  ❌ No json_agg found');
    return null;
  }
  
  const arrayStart = resultStr.indexOf('[', idx + startMarker.length);
  if (arrayStart === -1) return null;
  
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
  
  if (arrayEnd === -1) return null;
  
  const jsonStr = resultStr.substring(arrayStart, arrayEnd + 1);
  return JSON.parse(jsonStr);
}

async function postBatch(table, rows) {
  let total = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
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
        const r2 = await fetch(`${TARGET_URL}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            'apikey': TARGET_KEY,
            'Authorization': `Bearer ${TARGET_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=ignore-duplicates,return=minimal'
          },
          body: JSON.stringify(row)
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
  console.log('🚨 RESTORING MARKETING DATA');
  
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
      console.log(`  ✅ ${inserted}/${data.length} inserted`);
    } catch(e) {
      console.log(`  ❌ ${e.message}`);
    }
  }
}

main().catch(console.error);
