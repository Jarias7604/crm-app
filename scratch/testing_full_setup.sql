-- =====================================================================
-- COMPLETE SETUP: Project Management Module for Testing DB
-- Run this entire script in: 
-- https://supabase.com/dashboard/project/ubqscyfefgfbmndnypbp/sql/new
-- =====================================================================

-- 1. Create Projects Table
CREATE TABLE IF NOT EXISTS public.crm_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.crm_projects ENABLE ROW LEVEL SECURITY;

-- 2. Create Tasks Table (with correct status constraint from the start)
CREATE TABLE IF NOT EXISTS public.crm_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.crm_projects(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES public.crm_tasks(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'paused', 'pending_approval', 'rejected', 'completed')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    estimated_hours NUMERIC(6, 2) DEFAULT 0.00,
    start_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    checklist JSONB DEFAULT '[]'::jsonb,
    rejection_reason TEXT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

-- 3. Create Time Logs Table
CREATE TABLE IF NOT EXISTS public.crm_task_time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    stopped_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.crm_task_time_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Projects
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_projects' AND policyname='crm_projects_all_policy') THEN
        CREATE POLICY "crm_projects_all_policy" ON public.crm_projects
            FOR ALL TO authenticated
            USING (company_id = get_auth_company_id())
            WITH CHECK (company_id = get_auth_company_id());
    END IF;
END $$;

-- 5. RLS Policies for Tasks
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_tasks' AND policyname='crm_tasks_all_policy') THEN
        CREATE POLICY "crm_tasks_all_policy" ON public.crm_tasks
            FOR ALL TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.crm_projects p 
                    WHERE p.id = crm_tasks.project_id AND p.company_id = get_auth_company_id()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.crm_projects p 
                    WHERE p.id = crm_tasks.project_id AND p.company_id = get_auth_company_id()
                )
            );
    END IF;
END $$;

-- 6. RLS Policies for Time Logs
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_task_time_logs' AND policyname='crm_task_time_logs_all_policy') THEN
        CREATE POLICY "crm_task_time_logs_all_policy" ON public.crm_task_time_logs
            FOR ALL TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.crm_tasks t
                    JOIN public.crm_projects p ON t.project_id = p.id
                    WHERE t.id = crm_task_time_logs.task_id AND p.company_id = get_auth_company_id()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.crm_tasks t
                    JOIN public.crm_projects p ON t.project_id = p.id
                    WHERE t.id = crm_task_time_logs.task_id AND p.company_id = get_auth_company_id()
                )
            );
    END IF;
END $$;

-- 7. Duration calculation trigger
CREATE OR REPLACE FUNCTION public.fn_auto_calc_task_time_duration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.stopped_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.stopped_at - NEW.started_at))::integer;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_calc_task_time_duration ON public.crm_task_time_logs;
CREATE TRIGGER trg_auto_calc_task_time_duration
BEFORE INSERT OR UPDATE ON public.crm_task_time_logs
FOR EACH ROW EXECUTE FUNCTION public.fn_auto_calc_task_time_duration();

-- Done
SELECT 'crm_tasks table created with correct constraints' as result;
