/**
 * Fix los 5 follow_ups restantes sin company_id
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mtxqqamitglhehaktgxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ARIAS = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';

async function fixRemainingFollowUps() {
  // Find the 5 remaining follow_ups without company_id
  const { data: orphans } = await supabase
    .from('follow_ups')
    .select('id, lead_id, company_id')
    .is('company_id', null);

  console.log(`Found ${orphans?.length || 0} follow_ups without company_id:`);
  
  for (const f of (orphans || [])) {
    // Try to find the lead
    const { data: lead } = await supabase
      .from('leads')
      .select('id, company_id')
      .eq('id', f.lead_id)
      .single();

    if (lead?.company_id) {
      // Fix: assign company_id from the lead
      const { error } = await supabase
        .from('follow_ups')
        .update({ company_id: lead.company_id })
        .eq('id', f.id);
      console.log(`  ✅ Fixed follow_up ${f.id} → ${lead.company_id}`);
    } else {
      // Orphaned follow_up with no valid lead — assign to Arias (safe default since these are old Arias records)
      const { error } = await supabase
        .from('follow_ups')
        .update({ company_id: ARIAS })
        .eq('id', f.id);
      console.log(`  ✅ Fixed orphaned follow_up ${f.id} → Arias Defense (no lead found)`);
    }
  }

  // Final verification
  const { data: check } = await supabase
    .from('follow_ups')
    .select('company_id')
    .is('company_id', null);

  if ((check?.length || 0) === 0) {
    console.log('\n✅ TODOS los follow_ups tienen company_id — Calendario 100% aislado');
  } else {
    console.log(`\n⚠️ Quedan ${check?.length} sin company_id`);
  }
}

fixRemainingFollowUps().catch(console.error);
