-- EJECUTAR EN SUPABASE SQL EDITOR
-- https://supabase.com/dashboard/project/ikofyypxphrqkncimszt/sql

-- Agregar columnas a leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS value numeric DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_followup_date timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_followup_assignee uuid;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_action_notes text;

-- Agregar columnas a follow_ups
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS action_type text DEFAULT 'call';
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS notes text;

-- Verificar
SELECT 'Columnas agregadas!' as resultado;
