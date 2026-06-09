-- =================================================================
-- RECOVERY SCRIPT: Restore dropped RBAC Policies due to CASCADE
-- Date: 2026-06-08
-- Description: Recreates all specialized RBAC policies for follow_ups,
--              call_activities, cotizaciones, and tickets that were
--              dropped when get_auth_company_id() was dropped with CASCADE.
--              Includes support for parent-child workspaces.
-- =================================================================

-- 1. Ensure helper is_company_manager exists
CREATE OR REPLACE FUNCTION public.is_company_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'company_admin')
      AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_manager() TO authenticated;

-- ================================================================
-- TABLE: follow_ups
-- ================================================================
DROP POLICY IF EXISTS "follow_ups_tenant_policy" ON public.follow_ups;
DROP POLICY IF EXISTS "follow_ups_admin_all"      ON public.follow_ups;
DROP POLICY IF EXISTS "follow_ups_agent_own"      ON public.follow_ups;

-- Admins: all follow-ups of their company and child companies
CREATE POLICY "follow_ups_admin_all" ON public.follow_ups FOR ALL TO authenticated
  USING (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND public.is_company_manager()
  )
  WITH CHECK (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND public.is_company_manager()
  );

-- Sales agents: only their own follow-ups (assigned to them or created by them)
CREATE POLICY "follow_ups_agent_own" ON public.follow_ups FOR ALL TO authenticated
  USING (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND NOT public.is_company_manager()
    AND (assigned_to = auth.uid() OR user_id = auth.uid())
  )
  WITH CHECK (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND NOT public.is_company_manager()
    AND (assigned_to = auth.uid() OR user_id = auth.uid())
  );


-- ================================================================
-- TABLE: call_activities
-- ================================================================
DROP POLICY IF EXISTS "call_activities_tenant_policy" ON public.call_activities;
DROP POLICY IF EXISTS "call_activities_admin_all"      ON public.call_activities;
DROP POLICY IF EXISTS "call_activities_agent_own"      ON public.call_activities;

-- Admins: all calls of their company and child companies
CREATE POLICY "call_activities_admin_all" ON public.call_activities FOR ALL TO authenticated
  USING (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND public.is_company_manager()
  )
  WITH CHECK (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND public.is_company_manager()
  );

-- Sales agents: only calls made by them
CREATE POLICY "call_activities_agent_own" ON public.call_activities FOR ALL TO authenticated
  USING (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND NOT public.is_company_manager()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND NOT public.is_company_manager()
    AND user_id = auth.uid()
  );


-- ================================================================
-- TABLE: cotizaciones (Quotes)
-- ================================================================
DROP POLICY IF EXISTS "cotizaciones_tenant_policy"   ON public.cotizaciones;
DROP POLICY IF EXISTS "cotizaciones_company_isolation" ON public.cotizaciones;
DROP POLICY IF EXISTS "cotizaciones_admin_all"        ON public.cotizaciones;
DROP POLICY IF EXISTS "cotizaciones_agent_own"        ON public.cotizaciones;

-- Admins: all quotes of their company and child companies
CREATE POLICY "cotizaciones_admin_all" ON public.cotizaciones FOR ALL TO authenticated
  USING (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND public.is_company_manager()
  )
  WITH CHECK (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND public.is_company_manager()
  );

-- Sales agents: only quotes created by them
CREATE POLICY "cotizaciones_agent_own" ON public.cotizaciones FOR ALL TO authenticated
  USING (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND NOT public.is_company_manager()
    AND created_by = auth.uid()
  )
  WITH CHECK (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND NOT public.is_company_manager()
    AND created_by = auth.uid()
  );


-- ================================================================
-- TABLE: tickets (Service Hub)
-- ================================================================
DROP POLICY IF EXISTS "tickets_tenant_policy" ON public.tickets;
DROP POLICY IF EXISTS "tickets_admin_all" ON public.tickets;
DROP POLICY IF EXISTS "tickets_agent_own" ON public.tickets;

-- Admins: all tickets of their company and child companies
CREATE POLICY "tickets_admin_all" ON public.tickets FOR ALL TO authenticated
  USING (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND public.is_company_manager()
  )
  WITH CHECK (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND public.is_company_manager()
  );

-- Sales agents: only tickets assigned to them or created by them
CREATE POLICY "tickets_agent_own" ON public.tickets FOR ALL TO authenticated
  USING (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND NOT public.is_company_manager()
    AND (assigned_to = auth.uid() OR created_by = auth.uid())
  )
  WITH CHECK (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND NOT public.is_company_manager()
    AND (assigned_to = auth.uid() OR created_by = auth.uid())
  );
