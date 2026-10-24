-- ================================================================
-- PHASE 13: STRICT IMMUTABILITY RULES FOR TIMESHEETS
-- 1. Prevent duplicate logs per (company_id, user_id, work_date)
-- 2. Once submitted, approved, or paid: regular employees CANNOT edit
-- 3. Only admins can edit submitted/approved logs
-- 4. Employees can only edit if status is 'draft' or 'rejected'
-- ================================================================

-- 1. Unique constraint to avoid duplicates per employee per day
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_timesheets_user_date 
ON public.team_timesheets(company_id, user_id, work_date);

-- 2. Strict RLS Update Policy
DROP POLICY IF EXISTS "timesheets_update_policy" ON public.team_timesheets;
CREATE POLICY "timesheets_update_policy" ON public.team_timesheets
    FOR UPDATE TO authenticated
    USING (
        -- Colaborador: solo si es borrador o rechazado para corregir
        (user_id = auth.uid() AND status IN ('draft', 'rejected'))
        -- Administradores: pueden editar/desbloquear cualquier registro de su empresa
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR (profiles.company_id = team_timesheets.company_id AND profiles.role = 'company_admin'))
        )
    )
    WITH CHECK (
        (user_id = auth.uid() AND status IN ('draft', 'submitted', 'rejected'))
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR (profiles.company_id = team_timesheets.company_id AND profiles.role = 'company_admin'))
        )
    );

-- 3. Strict RLS Delete Policy
DROP POLICY IF EXISTS "timesheets_delete_policy" ON public.team_timesheets;
CREATE POLICY "timesheets_delete_policy" ON public.team_timesheets
    FOR DELETE TO authenticated
    USING (
        (user_id = auth.uid() AND status = 'draft')
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR (profiles.company_id = team_timesheets.company_id AND profiles.role = 'company_admin'))
        )
    );
