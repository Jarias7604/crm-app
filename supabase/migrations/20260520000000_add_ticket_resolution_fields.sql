-- ============================================================
-- Migration: Add Resolution Report fields to tickets
-- Date: 2026-05-20
-- Purpose: Allow technicians to document findings, root cause
--          and solution when closing a ticket
-- ============================================================

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS findings      TEXT,
  ADD COLUMN IF NOT EXISTS root_cause    TEXT,
  ADD COLUMN IF NOT EXISTS solution      TEXT;

-- resolution_attachments is stored inside the existing metadata JSONB column
-- so no schema change is needed for file attachments — they go into
-- metadata->resolution_attachments as an array of {url, name, type, size}

COMMENT ON COLUMN tickets.findings   IS 'What the technician found (Findings)';
COMMENT ON COLUMN tickets.root_cause IS 'Root cause of the incident';
COMMENT ON COLUMN tickets.solution   IS 'Permanent fix / preventive action taken';
