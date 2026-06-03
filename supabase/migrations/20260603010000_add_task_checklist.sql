-- Migration: Add checklist to tasks
-- Date: 2026-06-03

ALTER TABLE public.crm_tasks 
ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;
