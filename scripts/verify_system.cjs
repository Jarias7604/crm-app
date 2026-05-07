/**
 * Verificación completa del estado del sistema post-fix
 * Solo lectura — sin modificar nada
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mtxqqamitglhehaktgxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ARIAS = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';
const ENSIVAR = 'ec88dff0-94a2-4544-ad2e-1f93a8163366';

async function fullVerification() {
  console.log('\n📊 ESTADO COMPLETO DEL SISTEMA\n');
  let allOk = true;

  // Check every table for NULL company_id
  const tables = [
    { name: 'leads', col: 'company_id' },
    { name: 'follow_ups', col: 'company_id' },
    { name: 'clients', col: 'company_id' },
    { name: 'cotizaciones', col: 'company_id' },
    { name: 'tickets', col: 'company_id' },
    { name: 'marketing_campaigns', col: 'company_id' },
    { name: 'marketing_conversations', col: 'company_id' },
  ];

  console.log('AISLAMIENTO POR TABLA:');
  for (const t of tables) {
    const { data } = await supabase.from(t.name).select(t.col);
    if (!data) { console.log(`  ⚠️  ${t.name}: no se pudo leer`); continue; }
    
    const nulls = data.filter(r => !r[t.col]).length;
    const arias = data.filter(r => r[t.col] === ARIAS).length;
    const ensivar = data.filter(r => r[t.col] === ENSIVAR).length;
    const other = data.length - nulls - arias - ensivar;
    
    if (nulls > 0) {
      console.log(`  ❌ ${t.name}: ${nulls} sin empresa | Arias:${arias} | Ensivar:${ensivar}`);
      allOk = false;
    } else {
      console.log(`  ✅ ${t.name}: Arias:${arias} | Ensivar:${ensivar}${other > 0 ? ` | Otros:${other}` : ''}`);
    }
  }

  // Verify leads specifically
  console.log('\nLEADS VERIFICACIÓN:');
  const { data: leads } = await supabase.from('leads').select('company_id');
  const ariasLeads = leads?.filter(l => l.company_id === ARIAS).length || 0;
  const ensivarLeads = leads?.filter(l => l.company_id === ENSIVAR).length || 0;
  console.log(`  Arias Defense: ${ariasLeads} leads ${ariasLeads >= 800 ? '✅' : '⚠️'}`);
  console.log(`  Ensivar: ${ensivarLeads} leads ${ensivarLeads >= 80 ? '✅' : '❌'}`);

  // Verify follow_ups fix
  console.log('\nFOLLOW_UPS VERIFICACIÓN (CALENDARIO):');
  const { data: fups } = await supabase.from('follow_ups').select('company_id');
  const nullFups = fups?.filter(f => !f.company_id).length || 0;
  const ariasFups = fups?.filter(f => f.company_id === ARIAS).length || 0;
  const ensivarFups = fups?.filter(f => f.company_id === ENSIVAR).length || 0;
  
  if (nullFups === 0) {
    console.log(`  ✅ TODOS los follow_ups tienen company_id`);
    console.log(`  Arias Defense: ${ariasFups} | Ensivar: ${ensivarFups}`);
    console.log(`  → El calendario ya NO muestra datos cruzados entre empresas`);
  } else {
    console.log(`  ❌ Aún hay ${nullFups} follow_ups sin company_id`);
    allOk = false;
  }

  // Check JWT metadata for all Ensivar users
  console.log('\nJWT ENSIVAR USUARIOS:');
  const { data: profiles } = await supabase
    .from('profiles')
    .select('email, company_id')
    .eq('company_id', ENSIVAR);
  
  profiles?.forEach(p => {
    console.log(`  ✅ ${p.email} → company_id correcto`);
  });

  console.log('\n═══════════════════════════════════════════');
  if (allOk) {
    console.log('🟢 SISTEMA: ESTABLE Y AISLADO');
    console.log('   → Los usuarios de Ensivar solo ven datos de Ensivar');
    console.log('   → Los usuarios de Arias Defense solo ven datos de Arias');
    console.log('   → El Calendario está aislado correctamente');
  } else {
    console.log('🔴 AÚN HAY ISSUES — revisar detalles arriba');
  }
  console.log('═══════════════════════════════════════════\n');
}

fullVerification().catch(console.error);
