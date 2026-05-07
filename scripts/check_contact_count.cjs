const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mtxqqamitglhehaktgxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkContactCount() {
  console.log('\n=== DIAGNÓSTICO: contact_count en Leads ===\n');

  // Check distribution of contact_count
  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, contact_count, status')
    .eq('company_id', '7a582ba5-f7d0-4ae3-9985-35788deb1c30')
    .order('contact_count', { ascending: false })
    .limit(20);

  const withCount = leads?.filter(l => (l.contact_count || 0) > 0) || [];
  const withoutCount = leads?.filter(l => !l.contact_count || l.contact_count === 0) || [];

  console.log(`Leads con contact_count > 0: ${withCount.length}`);
  console.log(`Leads con contact_count = 0: ${withoutCount.length}`);
  
  if (withCount.length > 0) {
    console.log('\nTop 10 leads con más seguimientos:');
    withCount.slice(0, 10).forEach(l => {
      console.log(`  📞${l.contact_count} | ${l.name} | ${l.status}`);
    });
  } else {
    console.log('\n⚠️  NINGÚN lead tiene contact_count > 0 en la DB');
    console.log('   El campo está en 0/NULL para todos los leads');
    
    // Check follow_ups count per lead to see real activity
    const { data: fupCounts } = await supabase
      .from('follow_ups')
      .select('lead_id')
      .eq('company_id', '7a582ba5-f7d0-4ae3-9985-35788deb1c30');
    
    const counts = {};
    fupCounts?.forEach(f => { counts[f.lead_id] = (counts[f.lead_id] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => (b[1] as number) - (a[1] as number));
    
    console.log(`\n   Pero hay ${fupCounts?.length} follow_ups en DB.`);
    console.log(`   Top leads por follow_ups reales:`);
    sorted.slice(0, 5).forEach(([leadId, count]) => {
      console.log(`     lead: ${leadId.substring(0,8)}... → ${count} follow_ups`);
    });
    
    console.log('\n   → El contact_count se desincronizó de los follow_ups reales');
    console.log('   → Necesita recalcularse desde la tabla follow_ups');
  }

  // Total leads with contact_count check
  const { count: total } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', '7a582ba5-f7d0-4ae3-9985-35788deb1c30')
    .gt('contact_count', 0);
  
  console.log(`\nTotal leads Arias Defense con contact_count > 0: ${total}`);
}

checkContactCount().catch(console.error);
