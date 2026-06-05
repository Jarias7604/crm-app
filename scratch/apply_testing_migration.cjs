// Apply constraint fix to TESTING database (ubqscyfefgfbmndnypbp)
// Uses supabase DB URL directly from supabase link config
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sql = `
ALTER TABLE public.crm_tasks DROP CONSTRAINT IF EXISTS crm_tasks_status_check;
ALTER TABLE public.crm_tasks ADD CONSTRAINT crm_tasks_status_check 
  CHECK (status IN ('todo', 'in_progress', 'paused', 'pending_approval', 'rejected', 'completed'));
ALTER TABLE public.crm_tasks ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.crm_tasks ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crm_tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.crm_tasks ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
`;

// Write the SQL to a temp file
const sqlFile = path.join(__dirname, 'fix_testing.sql');
fs.writeFileSync(sqlFile, sql);

console.log("Applying migration to TESTING database (ubqscyfefgfbmndnypbp)...");

try {
  const result = execSync(
    `npx supabase db execute --file "${sqlFile}"`,
    { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 30000 }
  );
  console.log("✅ Success:", result);
} catch (err) {
  console.error("❌ Error:", err.stderr || err.message);
  console.log("\nManual SQL to run at https://supabase.com/dashboard/project/ubqscyfefgfbmndnypbp/sql/new:");
  console.log(sql);
}

// Cleanup
try { fs.unlinkSync(sqlFile); } catch {}
