-- ================================================================
-- PHASE 13B: FICHA DE EMPLEADO, BONOS, COMISIONES Y HORARIO DE HORAS EXTRAS
-- Target Databases: ubqscyfefgfbmndnypbp (Testing) / mtxqqamitglhehaktgxm (CRM Prod)
-- Safe, idempotent execution (IF NOT EXISTS)
-- ================================================================

-- 1. Nuevos campos en payroll_member_configs (Ficha Técnica Salarial)
ALTER TABLE public.payroll_member_configs
ADD COLUMN IF NOT EXISTS employee_code TEXT,
ADD COLUMN IF NOT EXISTS hire_date DATE,
ADD COLUMN IF NOT EXISTS applies_overtime BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS expected_weekly_hours NUMERIC(5,2) NOT NULL DEFAULT 44.00 CHECK (expected_weekly_hours > 0 AND expected_weekly_hours <= 80),
ADD COLUMN IF NOT EXISTS commission_mode TEXT NOT NULL DEFAULT 'manual' CHECK (commission_mode IN ('manual', 'percentage_sales', 'fixed_per_deal')),
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (commission_rate >= 0),
ADD COLUMN IF NOT EXISTS bonus_kpi_default NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (bonus_kpi_default >= 0);

-- 2. Nuevos campos en team_timesheets para Horario Específico de Horas Extras
ALTER TABLE public.team_timesheets
ADD COLUMN IF NOT EXISTS overtime_start_time TEXT,
ADD COLUMN IF NOT EXISTS overtime_end_time TEXT;

-- 3. Índices de soporte
CREATE INDEX IF NOT EXISTS idx_payroll_configs_employee_code
ON public.payroll_member_configs(company_id, employee_code);

COMMENT ON COLUMN public.payroll_member_configs.employee_code IS 'Código identificador único del empleado (ej. EMP-001)';
COMMENT ON COLUMN public.payroll_member_configs.hire_date IS 'Fecha oficial de contratación o ingreso a la empresa';
COMMENT ON COLUMN public.payroll_member_configs.applies_overtime IS 'Indica si al colaborador se le reconocen monetariamente las horas extras';
COMMENT ON COLUMN public.payroll_member_configs.expected_weekly_hours IS 'Jornada laboral ordinaria pactada por semana (ej. 44h Latam o 40h US)';
COMMENT ON COLUMN public.team_timesheets.overtime_start_time IS 'Hora inicio de la labor extraordinaria (ej. 17:00)';
COMMENT ON COLUMN public.team_timesheets.overtime_end_time IS 'Hora fin de la labor extraordinaria (ej. 21:00)';
