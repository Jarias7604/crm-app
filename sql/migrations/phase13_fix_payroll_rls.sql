-- ================================================================
-- PHASE 13 FIX: RLS POLICIES USING profiles.role INSTEAD OF JWT CLAIM
-- ================================================================

-- 1. payroll_member_configs
DROP POLICY IF EXISTS "payroll_configs_select_policy" ON public.payroll_member_configs;
CREATE POLICY "payroll_configs_select_policy" ON public.payroll_member_configs
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR (profiles.company_id = payroll_member_configs.company_id AND profiles.role = 'company_admin'))
        )
    );

DROP POLICY IF EXISTS "payroll_configs_all_admin_policy" ON public.payroll_member_configs;
CREATE POLICY "payroll_configs_all_admin_policy" ON public.payroll_member_configs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR (profiles.company_id = payroll_member_configs.company_id AND profiles.role = 'company_admin'))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR (profiles.company_id = payroll_member_configs.company_id AND profiles.role = 'company_admin'))
        )
    );

-- 2. team_timesheets
DROP POLICY IF EXISTS "timesheets_select_policy" ON public.team_timesheets;
CREATE POLICY "timesheets_select_policy" ON public.team_timesheets
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR (profiles.company_id = team_timesheets.company_id AND profiles.role = 'company_admin'))
        )
    );

DROP POLICY IF EXISTS "timesheets_insert_policy" ON public.team_timesheets;
CREATE POLICY "timesheets_insert_policy" ON public.team_timesheets
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR profiles.role = 'company_admin')
        )
    );

DROP POLICY IF EXISTS "timesheets_update_policy" ON public.team_timesheets;
CREATE POLICY "timesheets_update_policy" ON public.team_timesheets
    FOR UPDATE TO authenticated
    USING (
        (user_id = auth.uid() AND status IN ('draft', 'submitted', 'rejected'))
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR (profiles.company_id = team_timesheets.company_id AND profiles.role = 'company_admin'))
        )
    );

DROP POLICY IF EXISTS "timesheets_delete_policy" ON public.team_timesheets;
CREATE POLICY "timesheets_delete_policy" ON public.team_timesheets
    FOR DELETE TO authenticated
    USING (
        (user_id = auth.uid() AND status IN ('draft', 'submitted'))
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR (profiles.company_id = team_timesheets.company_id AND profiles.role = 'company_admin'))
        )
    );

-- 3. payroll_runs & payroll_run_items
DROP POLICY IF EXISTS "payroll_runs_admin_policy" ON public.payroll_runs;
CREATE POLICY "payroll_runs_admin_policy" ON public.payroll_runs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR (profiles.company_id = payroll_runs.company_id AND profiles.role = 'company_admin'))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR (profiles.company_id = payroll_runs.company_id AND profiles.role = 'company_admin'))
        )
    );

DROP POLICY IF EXISTS "payroll_run_items_admin_policy" ON public.payroll_run_items;
CREATE POLICY "payroll_run_items_admin_policy" ON public.payroll_run_items
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR (profiles.company_id = payroll_run_items.company_id AND profiles.role = 'company_admin'))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR (profiles.company_id = payroll_run_items.company_id AND profiles.role = 'company_admin'))
        )
    );
