-- Migration: Add missing google_email column to calendar_integrations
-- This column is required by the google-calendar-sync Edge Function
-- Run this in: Supabase Dashboard > SQL Editor (project: mtxqqamitglhehaktgxm)

ALTER TABLE calendar_integrations 
ADD COLUMN IF NOT EXISTS google_email TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'calendar_integrations'
ORDER BY ordinal_position;
