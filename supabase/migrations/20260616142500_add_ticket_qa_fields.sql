-- Migration: Add QA Checklist and tracking hours to tickets
-- Date: 2026-06-16

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_hours NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tickets.estimated_hours IS 'Estimated completion hours for the ticket';
COMMENT ON COLUMN public.tickets.actual_hours IS 'Actual executed hours spent on the ticket';
COMMENT ON COLUMN public.tickets.checklist IS 'QA test cases list (json array of {id, text, status})';
