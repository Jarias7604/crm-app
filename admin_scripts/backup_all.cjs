require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const dir = path.join(__dirname, 'backups');

async function backup(table) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) { console.error(`❌ ${table}: ${error.message}`); return; }
  const file = path.join(dir, `${table}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`✅ ${table}: ${data.length} registros → ${file}`);
}

async function main() {
  console.log('=== BACKUP COMPLETO ===\n');
  const tables = [
    'leads', 'clients', 'client_documents', 'follow_ups',
    'cotizaciones', 'cotizacion_items', 'profiles', 'companies',
    'tickets', 'ticket_messages', 'marketing_campaigns',
    'marketing_conversations', 'marketing_messages',
    'flyer_assets', 'client_pipeline_stages', 'pipeline_stage_doc_types',
    'lead_sources', 'loss_reasons', 'company_settings'
  ];
  for (const t of tables) {
    await backup(t);
  }
  console.log('\n=== BACKUP COMPLETADO ===');
}
main();
