-- =====================================================
-- ENHANCED LEADS SCHEMA - EJECUTAR EN SUPABASE SQL EDITOR
-- =====================================================

-- 1. Create priority enum type
DO $$ BEGIN
    CREATE TYPE lead_priority AS ENUM ('very_high', 'high', 'medium', 'low');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add new columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS value numeric DEFAULT 0;

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS company_name text;

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS next_followup_date timestamp with time zone;

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS next_followup_assignee uuid REFERENCES public.profiles(id);

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS next_action_notes text;

-- 3. Enhance follow_ups table
ALTER TABLE public.follow_ups 
ADD COLUMN IF NOT EXISTS action_type text DEFAULT 'call';

ALTER TABLE public.follow_ups 
ADD COLUMN IF NOT EXISTS notes text;

-- 4. Update RLS policies for follow_ups to allow inserts
DROP POLICY IF EXISTS "Users can insert follow_ups for their company leads" ON public.follow_ups;

CREATE POLICY "Users can insert follow_ups for their company leads"
ON public.follow_ups FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.leads l
        JOIN public.profiles p ON p.company_id = l.company_id
        WHERE l.id = lead_id AND p.id = auth.uid()
    )
);

-- 5. Verification
SELECT 'Schema enhanced successfully!' as status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'leads' AND table_schema = 'public';
