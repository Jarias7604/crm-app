-- Allow public select access to active saas_plans
DROP POLICY IF EXISTS "saas_plans_read_all" ON public.saas_plans;
CREATE POLICY "saas_plans_read_all" ON public.saas_plans
    FOR SELECT TO public USING (is_active = true);
