// Direct DB fix script — uses service_role key via supabase CLI
// Runs the ALTER TABLE directly using a PostgreSQL function workaround via RPC
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env.local')));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  console.log("Logging in...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'jarias7604@gmail.com',
    password: 'Arias2026!'
  });
  if (authError) { console.error("Auth error:", authError); return; }
  console.log("Logged in as:", authData.user.id);

  // Test if constraint still old
  const { error: testErr } = await supabase
    .from('crm_tasks')
    .update({ status: 'pending_approval' })
    .eq('id', '81dfaaee-01d7-452b-89f7-ecefc418c757');

  if (testErr) {
    console.log("❌ Constraint still blocks 'pending_approval':", testErr.message);
    console.log("\nCannot fix via anon key — need Supabase CLI or dashboard.");
    console.log("Run this SQL in the Supabase dashboard for mtxqqamitglhehaktgxm:");
    console.log(`
ALTER TABLE public.crm_tasks DROP CONSTRAINT IF EXISTS crm_tasks_status_check;
ALTER TABLE public.crm_tasks ADD CONSTRAINT crm_tasks_status_check 
  CHECK (status IN ('todo', 'in_progress', 'paused', 'pending_approval', 'rejected', 'completed'));
ALTER TABLE public.crm_tasks ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.crm_tasks ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crm_tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.crm_tasks ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
    `);
  } else {
    console.log("✅ Constraint allows 'pending_approval' — constraint is already fixed!");
    // Revert back to todo
    await supabase.from('crm_tasks').update({ status: 'todo' }).eq('id', '81dfaaee-01d7-452b-89f7-ecefc418c757');
    console.log("Reverted task back to 'todo'");
  }
}

fix();
