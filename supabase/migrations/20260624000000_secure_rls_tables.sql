-- 1. Enable RLS on lead_marketing_stats and add policies
ALTER TABLE public.lead_marketing_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'lead_marketing_stats' AND policyname = 'Users can view marketing stats of their company'
    ) THEN
        CREATE POLICY "Users can view marketing stats of their company" 
        ON public.lead_marketing_stats FOR SELECT TO authenticated
        USING (lead_id IN (SELECT id FROM public.leads WHERE company_id = get_auth_company_id()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'lead_marketing_stats' AND policyname = 'Users can insert marketing stats of their company'
    ) THEN
        CREATE POLICY "Users can insert marketing stats of their company" 
        ON public.lead_marketing_stats FOR INSERT TO authenticated
        WITH CHECK (lead_id IN (SELECT id FROM public.leads WHERE company_id = get_auth_company_id()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'lead_marketing_stats' AND policyname = 'Users can update marketing stats of their company'
    ) THEN
        CREATE POLICY "Users can update marketing stats of their company" 
        ON public.lead_marketing_stats FOR UPDATE TO authenticated
        USING (lead_id IN (SELECT id FROM public.leads WHERE company_id = get_auth_company_id()))
        WITH CHECK (lead_id IN (SELECT id FROM public.leads WHERE company_id = get_auth_company_id()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'lead_marketing_stats' AND policyname = 'Users can delete marketing stats of their company'
    ) THEN
        CREATE POLICY "Users can delete marketing stats of their company" 
        ON public.lead_marketing_stats FOR DELETE TO authenticated
        USING (lead_id IN (SELECT id FROM public.leads WHERE company_id = get_auth_company_id()));
    END IF;
END
$$;

-- 2. Enable RLS on login_attempts (no policies = block direct client access)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- 3. Clean up unused debugging table
DROP TABLE IF EXISTS public.temp_debug_policies;
