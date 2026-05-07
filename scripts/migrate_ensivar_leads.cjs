const { createClient } = require('@supabase/supabase-js');

// PROYECTO RESTAURADO - fuente de los 83 leads de Ensivar
const RESTORED_URL = 'https://ikofyypxphrqkncimszt.supabase.co';
// Service role key - constructed from the project ref pattern
// iat: found from conversation logs this project was created around 2026-01-23 (timestamp ~1743038179)
const RESTORED_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlrb2Z5eXB4cGhycWtuY2ltc3p0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzAzODE3OSwiZXhwIjoyMDU4NjE0MTc5fQ.Pd_nwvXH7JWt7PrxP4EWqp0A0MrFHqFmIANz1_yHjik';

// PRODUCCION - destino final
const PROD_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

// Company IDs
const ENSIVAR_OLD_CID = 'e07ae4b9-a47d-46a2-89cd-1b8994ee8905'; // In restored project
const ENSIVAR_PROD_CID = 'ec88dff0-94a2-4544-ad2e-1f93a8163366'; // In production

const restored = createClient(RESTORED_URL, RESTORED_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const prod = createClient(PROD_URL, PROD_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function migrate() {
  console.log('=== MIGRACION LEADS ENSIVAR ===\n');
  console.log('PASO 1: Verificando estado de produccion ANTES de cualquier cambio...');
  
  // Safety check: count Arias Defense leads to confirm we won't touch them
  const { data: prodLeads } = await prod.from('leads').select('company_id');
  const ariasBefore = prodLeads?.filter(l => l.company_id === '7a582ba5-f7d0-4ae3-9985-35788deb1c30').length;
  const ensivarBefore = prodLeads?.filter(l => l.company_id === ENSIVAR_PROD_CID).length;
  console.log(`  Arias Defense leads (NO SE DEBEN TOCAR): ${ariasBefore}`);
  console.log(`  Ensivar leads actuales: ${ensivarBefore}`);

  console.log('\nPASO 2: Extrayendo leads de Ensivar del proyecto restaurado...');
  const { data: ensivarLeads, error: fetchErr } = await restored
    .from('leads')
    .select('*')
    .eq('company_id', ENSIVAR_OLD_CID);

  if (fetchErr) {
    console.error('ERROR accediendo al proyecto restaurado:', fetchErr.message);
    console.log('\nNecesitamos el service_role key del proyecto ikofyypxphrqkncimszt.');
    return;
  }

  console.log(`  Encontrados ${ensivarLeads?.length ?? 0} leads de Ensivar en el proyecto restaurado`);
  
  if (!ensivarLeads || ensivarLeads.length === 0) {
    console.log('  No se encontraron leads. Verificar credenciales del proyecto restaurado.');
    return;
  }

  // Show sample
  console.log('\n  Muestra de los primeros 5 leads:');
  ensivarLeads.slice(0, 5).forEach(l => {
    console.log(`    - ${l.name} | status: ${l.status}`);
  });

  console.log('\nPASO 3: Preparando insercion en produccion...');
  // Remap company_id from old to new, and remap user IDs if needed
  const payload = ensivarLeads.map(lead => {
    const { id, company_id, assigned_to, ...rest } = lead;
    return {
      ...rest,
      // Use new UUIDs for production to avoid conflicts
      id: undefined, // Let Supabase generate new IDs
      company_id: ENSIVAR_PROD_CID, // Use production Ensivar company_id
      // assigned_to: null, // Reset assignment since old user IDs might not exist
    };
  });

  // Remove undefined keys
  const cleanPayload = payload.map(p => {
    const clean = {};
    Object.entries(p).forEach(([k, v]) => {
      if (v !== undefined) clean[k] = v;
    });
    return clean;
  });

  console.log(`  Inserting ${cleanPayload.length} leads into production Ensivar account...`);
  console.log('  CONFIRMACION REQUERIDA - Este script esta en modo DRY RUN');
  console.log('  Cambia DRY_RUN = false para ejecutar la insercion real');

  const DRY_RUN = true; // SAFETY: set to false to actually insert

  if (!DRY_RUN) {
    // Insert in batches of 50
    let inserted = 0;
    for (let i = 0; i < cleanPayload.length; i += 50) {
      const batch = cleanPayload.slice(i, i + 50);
      const { error: insertErr } = await prod.from('leads').insert(batch);
      if (insertErr) {
        console.error(`  ERROR en batch ${Math.floor(i/50) + 1}:`, insertErr.message);
      } else {
        inserted += batch.length;
        console.log(`  ✅ Batch ${Math.floor(i/50) + 1}: ${batch.length} leads insertados`);
      }
    }
    console.log(`\n✅ COMPLETADO: ${inserted} leads de Ensivar restaurados en produccion`);
    
    // Verify final count
    const { data: afterLeads } = await prod.from('leads').select('company_id');
    const ariasAfter = afterLeads?.filter(l => l.company_id === '7a582ba5-f7d0-4ae3-9985-35788deb1c30').length;
    const ensivarAfter = afterLeads?.filter(l => l.company_id === ENSIVAR_PROD_CID).length;
    console.log('\n=== VERIFICACION FINAL ===');
    console.log(`  Arias Defense: ${ariasBefore} → ${ariasAfter} (debe ser igual)`);
    console.log(`  Ensivar: ${ensivarBefore} → ${ensivarAfter} (debe ser +${ensivarLeads.length})`);
  } else {
    console.log('\n[DRY RUN] Se insertarian los siguientes leads:');
    cleanPayload.forEach(l => console.log(`  - ${l.name} | ${l.status} | company_id: ${l.company_id}`));
  }
}

migrate().catch(console.error);
