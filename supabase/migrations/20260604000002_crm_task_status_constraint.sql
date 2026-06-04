-- ============================================================
-- CRM Tasks — Update Status CHECK Constraint
-- Project: CRM (crm_tasks)
-- Created: 2026-06-04
-- ============================================================

-- Drop old check constraint that limited status to ('todo', 'in_progress', 'paused', 'completed')
ALTER TABLE public.crm_tasks
  DROP CONSTRAINT IF EXISTS crm_tasks_status_check;

-- Add updated check constraint to allow approval workflow statuses
ALTER TABLE public.crm_tasks
  ADD CONSTRAINT crm_tasks_status_check 
  CHECK (status IN ('todo', 'in_progress', 'paused', 'pending_approval', 'rejected', 'completed'));
