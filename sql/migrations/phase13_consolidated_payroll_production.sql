-- ================================================================
-- PHASE 13: CONSOLIDATED PAYROLL & TIMESHEETS ENGINE FOR PRODUCTION
-- Target Database: mtxqqamitglhehaktgxm (CRM Producción)
-- Safe, idempotent execution (IF NOT EXISTS, DROP POLICY IF EXISTS)
-- ================================================================

-- 1. Daily Work & Overtime Logs
CREATE TABLE IF NOT EXISTS public.team_timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    regular_hours NUMERIC(5,2) NOT NULL DEFAULT 8.00 CHECK (regular_hours >= 0 AND regular_hours <= 24),
    overtime_hours NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (overtime_hours >= 0 AND overtime_hours <= 24),
    overtime_reason TEXT,
    work_summary TEXT NOT NULL,
    project_id UUID REFERENCES public.crm_projects(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.crm_tasks(id) ON DELETE SET NULL,
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paid')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_timesheet_total_hours CHECK ((regular_hours + overtime_hours) <= 24),
    CONSTRAINT chk_timesheet_overtime_reason CHECK (
        overtime_hours = 0 OR (overtime_hours > 0 AND overtime_reason IS NOT NULL AND length(trim(overtime_reason)) >= 3)
    )
);

CREATE INDEX IF NOT EXISTS idx_team_timesheets_lookup 
ON public.team_timesheets(company_id, work_date, status);

CREATE INDEX IF NOT EXISTS idx_team_timesheets_user 
ON public.team_timesheets(user_id, work_date);

-- 2. Payroll Member Configurations (Hourly Rate, Contracts, Country Rules)
CREATE TABLE IF NOT EXISTS public.payroll_member_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payment_frequency TEXT NOT NULL DEFAULT 'quincenal' CHECK (payment_frequency IN ('semanal', 'quincenal', 'mensual', 'por_hora')),
    contract_type TEXT NOT NULL DEFAULT 'hourly' CHECK (contract_type IN ('hourly', 'salary', 'contractor_1099', 'services_sv')),
    hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (hourly_rate >= 0),
    base_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (base_salary >= 0),
    overtime_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.50 CHECK (overtime_multiplier >= 1.0),
    country TEXT NOT NULL DEFAULT 'SV' CHECK (country IN ('SV', 'US', 'OTHER')),
    apply_isss BOOLEAN NOT NULL DEFAULT true,
    apply_afp BOOLEAN NOT NULL DEFAULT true,
    apply_renta BOOLEAN NOT NULL DEFAULT true,
    renta_mode TEXT NOT NULL DEFAULT 'percentage' CHECK (renta_mode IN ('percentage', 'table', 'none')),
    renta_percentage NUMERIC(5,2) DEFAULT 10.00,
    isss_percentage NUMERIC(5,2) DEFAULT 3.00,
    afp_percentage NUMERIC(5,2) DEFAULT 7.25,
    custom_deductions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_configs_company_user 
ON public.payroll_member_configs(company_id, user_id);

-- 3. Payroll Closed Runs (Historial de Pagos y Cierres)
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
    total_gross NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_net NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Payroll Run Item Details (Desglose individual por empleado)
CREATE TABLE IF NOT EXISTS public.payroll_run_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    regular_hours NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    overtime_hours NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    regular_pay NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    overtime_pay NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    gross_pay NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    isss_deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    afp_deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    renta_deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    other_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_pay NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — REGLA 12 Y REGLA 9
-- ================================================================

ALTER TABLE public.team_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_member_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_run_items ENABLE ROW LEVEL SECURITY;

-- ── 1. Policies for payroll_member_configs ─────────────────────
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

-- ── 2. Policies for team_timesheets ───────────────────────────
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

-- ── 3. Policies for payroll_runs & payroll_run_items ───────────
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
