// Script to run the constraint migration on both databases
// Production: mtxqqamitglhehaktgxm
// Testing: ubqscyfefgfbmndnypbp
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Read service role keys from env.local (this uses anon key, will need service role)
const envConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env.local')));

// Migration SQL - ONLY for production (mtxqqamitglhehaktgxm which is what .env.local points to)
const migrationSQL = `
-- Drop old check constraint
ALTER TABLE public.crm_tasks
  DROP CONSTRAINT IF EXISTS crm_tasks_status_check;

-- Add updated check constraint to allow approval workflow statuses  
ALTER TABLE public.crm_tasks
  ADD CONSTRAINT crm_tasks_status_check 
  CHECK (status IN ('todo', 'in_progress', 'paused', 'pending_approval', 'rejected', 'completed'));

-- Also add the approval columns in case they don't exist yet
ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS rejection_reason   TEXT,
  ADD COLUMN IF NOT EXISTS approved_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_at       TIMESTAMPTZ;
`;

console.log("=== MIGRATION INSTRUCTIONS ===");
console.log("Run this SQL in BOTH Supabase projects:\n");
console.log("1. PRODUCTION: https://supabase.com/dashboard/project/mtxqqamitglhehaktgxm/sql/new");
console.log("2. TESTING:    https://supabase.com/dashboard/project/ubqscyfefgfbmndnypbp/sql/new\n");
console.log("SQL to run:");
console.log("---");
console.log(migrationSQL);
console.log("---");
