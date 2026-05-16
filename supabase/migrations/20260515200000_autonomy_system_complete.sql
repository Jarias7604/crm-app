-- Migration: Create ai_autonomy_settings table and RPC functions
-- Using migration file ensures PostgREST schema cache is reloaded automatically

-- Create table if not exists (safe to run even if already exists)
CREATE TABLE IF NOT EXISTS public.ai_autonomy_settings (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    autonomy_level TEXT NOT NULL DEFAULT 'copilot' 
        CHECK (autonomy_level IN ('copilot', 'semi', 'autopilot')),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES public.profiles(id)
);

-- Create ai_tasks table if not exists
CREATE TABLE IF NOT EXISTS public.ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL CHECK (agent_name IN ('oracle', 'maya', 'sofia', 'atlas')),
    task_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    payload JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'autopilot')),
    confidence NUMERIC(4,3) DEFAULT 0.75,
    impact_estimate TEXT,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_autonomy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tasks ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policies
DROP POLICY IF EXISTS "autonomy_settings_read" ON public.ai_autonomy_settings;
DROP POLICY IF EXISTS "autonomy_settings_write" ON public.ai_autonomy_settings;
DROP POLICY IF EXISTS "Admins can update their company autonomy settings" ON public.ai_autonomy_settings;
DROP POLICY IF EXISTS "Users can view their company autonomy settings" ON public.ai_autonomy_settings;

CREATE POLICY "autonomy_settings_read" ON public.ai_autonomy_settings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
        OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    );

CREATE POLICY "autonomy_settings_write" ON public.ai_autonomy_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
        OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() AND role = 'company_admin' LIMIT 1)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
        OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() AND role = 'company_admin' LIMIT 1)
    );

-- RPC: get autonomy level (security inside function)
CREATE OR REPLACE FUNCTION public.get_autonomy_level(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_level TEXT;
BEGIN
    SELECT autonomy_level INTO v_level
    FROM public.ai_autonomy_settings
    WHERE company_id = p_company_id;
    RETURN COALESCE(v_level, 'copilot');
END;
$$;

-- RPC: set autonomy level (security inside function - enterprise pattern)
CREATE OR REPLACE FUNCTION public.set_autonomy_level(p_company_id UUID, p_level TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_company_id UUID;
BEGIN
    SELECT role, company_id INTO v_role, v_company_id
    FROM public.profiles WHERE id = auth.uid();

    -- Super admin: access to any company. Company admin: only their own.
    IF NOT (v_role = 'super_admin' OR (v_role = 'company_admin' AND v_company_id = p_company_id)) THEN
        RAISE EXCEPTION 'No tienes permiso para cambiar esta configuración';
    END IF;

    INSERT INTO public.ai_autonomy_settings (company_id, autonomy_level, updated_at, updated_by)
    VALUES (p_company_id, p_level, now(), auth.uid())
    ON CONFLICT (company_id)
    DO UPDATE SET 
        autonomy_level = EXCLUDED.autonomy_level,
        updated_at = now(),
        updated_by = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_autonomy_level(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_autonomy_level(UUID, TEXT) TO authenticated;
