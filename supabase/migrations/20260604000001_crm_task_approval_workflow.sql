-- ============================================================
-- CRM Tasks — Supervisor Approval Workflow
-- Project: CRM (crm_tasks) — NOT ERP El Salvador
-- Created: 2026-06-04
-- ============================================================

-- Add approval workflow fields to crm_tasks
ALTER TABLE crm_tasks
  ADD COLUMN IF NOT EXISTS rejection_reason   TEXT,
  ADD COLUMN IF NOT EXISTS approved_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_at       TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN crm_tasks.rejection_reason IS 'Reason provided by supervisor or auto-system when task is rejected';
COMMENT ON COLUMN crm_tasks.approved_by      IS 'Profile ID of the supervisor who approved the task';
COMMENT ON COLUMN crm_tasks.approved_at      IS 'Timestamp when the task was approved by supervisor';
COMMENT ON COLUMN crm_tasks.submitted_at     IS 'Timestamp when the task was submitted for supervisor review';

-- NOTE: status column already exists as TEXT — new valid values are:
--   'todo' | 'in_progress' | 'paused' | 'pending_approval' | 'rejected' | 'completed'
-- No migration needed for status since it is TEXT without CHECK constraint.
