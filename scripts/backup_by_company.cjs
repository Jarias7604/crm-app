/**
 * BACKUP POR EMPRESA - CRM Multi-Tenant
 * Guarda un JSON separado por cada empresa/tenant.
 * Corre: node scripts/backup_by_company.cjs
 * 
 * NUNCA mezcla datos de empresas distintas en un mismo archivo.
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Producción CRM — crm-app (mtxqqamitglhehaktgxm)
const supabase = createClient(
  'https://mtxqqamitglhehaktgxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TODAY = new Date().toISOString().split('T')[0]; // e.g. 2026-05-07
const BACKUP_DIR = path.join(__dirname, '..', 'backups', TODAY);

const TABLES_WITH_COMPANY = [
  'leads', 'clients', 'follow_ups', 'cotizaciones',
  'tickets', 'marketing_campaigns', 'marketing_conversations'
];

async function backupByCompany() {
  console.log(`\n=== BACKUP POR EMPRESA — ${TODAY} ===\n`);

  // Create backup directory for today
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Creado directorio: ${BACKUP_DIR}\n`);
  }

  // Get all companies
  const { data: companies, error: compErr } = await supabase
    .from('companies').select('id, name');

  if (compErr) {
    console.error('❌ Error obteniendo empresas:', compErr.message);
    process.exit(1);
  }

  console.log(`Empresas encontradas: ${companies.length}`);
  companies.forEach(c => console.log(`  • ${c.name} (${c.id})`));
  console.log('');

  let totalRecords = 0;
  const summary = {};

  for (const company of companies) {
    const safeName = company.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    summary[company.name] = {};

    for (const table of TABLES_WITH_COMPANY) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('company_id', company.id);

      if (error) {
        // Table might not have company_id - skip
        continue;
      }

      if (data && data.length > 0) {
        const filename = `${safeName}_${table}.json`;
        const filepath = path.join(BACKUP_DIR, filename);
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`  ✅ ${company.name} / ${table}: ${data.length} registros → ${filename}`);
        summary[company.name][table] = data.length;
        totalRecords += data.length;
      }
    }
    console.log('');
  }

  // Write summary file
  const summaryFile = path.join(BACKUP_DIR, '_RESUMEN.json');
  const summaryData = {
    fecha: TODAY,
    timestamp: new Date().toISOString(),
    total_registros: totalRecords,
    por_empresa: summary
  };
  fs.writeFileSync(summaryFile, JSON.stringify(summaryData, null, 2));

  console.log('=== RESUMEN FINAL ===');
  companies.forEach(c => {
    const tables = summary[c.name];
    const total = Object.values(tables).reduce((a, b) => a + b, 0);
    console.log(`  ${c.name}: ${total} registros totales`);
    Object.entries(tables).forEach(([t, n]) => console.log(`    - ${t}: ${n}`));
  });
  console.log(`\n✅ Backup completado: ${totalRecords} registros totales en ${BACKUP_DIR}`);
  console.log(`📋 Resumen guardado en _RESUMEN.json`);
}

backupByCompany().catch(err => {
  console.error('❌ Error crítico en backup:', err);
  process.exit(1);
});
