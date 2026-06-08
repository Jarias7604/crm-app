-- =================================================================
-- MIGRACIÓN: Soporte de Sub-Workspaces Dinámicos (Parent-Child)
-- Fecha: 2026-06-08
-- =================================================================

-- Asegurar funciones auxiliares de autenticación RLS (limpiar primero si existen)
DROP FUNCTION IF EXISTS public.get_auth_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_auth_role() CASCADE;

CREATE OR REPLACE FUNCTION public.get_auth_company_id() RETURNS uuid AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'company_id', ''))::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.get_auth_role() RETURNS text AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role';
$$ LANGUAGE sql STABLE;

-- 1. Agregar columna parent_company_id a la tabla companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS parent_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- 2. Crear índice para optimizar consultas jerárquicas
CREATE INDEX IF NOT EXISTS idx_companies_parent_id ON public.companies(parent_company_id);

-- =================================================================
-- Actualizar RLS Policies de forma segura
-- =================================================================

-- COMPANIES
DROP POLICY IF EXISTS companies_select ON public.companies;
CREATE POLICY companies_select ON public.companies FOR SELECT TO authenticated
  USING (
    id = public.get_auth_company_id() 
    OR parent_company_id = public.get_auth_company_id() 
    OR public.get_auth_role() = 'super_admin'
  );

DROP POLICY IF EXISTS companies_update ON public.companies;
CREATE POLICY companies_update ON public.companies FOR UPDATE TO authenticated
  USING (
    id = public.get_auth_company_id() 
    OR parent_company_id = public.get_auth_company_id()
  )
  WITH CHECK (
    id = public.get_auth_company_id() 
    OR parent_company_id = public.get_auth_company_id()
  );

-- PROFILES
DROP POLICY IF EXISTS profiles_tenant_policy ON public.profiles;
CREATE POLICY profiles_tenant_policy ON public.profiles FOR ALL TO authenticated
  USING (
    id = auth.uid() 
    OR company_id = public.get_auth_company_id() 
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    id = auth.uid() 
    OR company_id = public.get_auth_company_id() 
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- LEADS
DROP POLICY IF EXISTS leads_isolation ON public.leads;
DROP POLICY IF EXISTS leads_tenant_policy ON public.leads;
CREATE POLICY leads_tenant_policy ON public.leads FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
    OR public.get_auth_role() = 'super_admin'
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
    OR public.get_auth_role() = 'super_admin'
  );

-- CLIENTS
DROP POLICY IF EXISTS company_access ON public.clients;
CREATE POLICY company_access ON public.clients FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- COTIZACIONES (Quotes)
DROP POLICY IF EXISTS cotizaciones_company_isolation ON public.cotizaciones;
CREATE POLICY cotizaciones_company_isolation ON public.cotizaciones FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- MARKETING INTEGRATIONS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'marketing_integrations') THEN
        DROP POLICY IF EXISTS marketing_integrations_tenant_policy ON public.marketing_integrations;
        EXECUTE 'CREATE POLICY marketing_integrations_tenant_policy ON public.marketing_integrations FOR ALL TO authenticated
          USING (
            company_id = public.get_auth_company_id()
            OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
          )
          WITH CHECK (
            company_id = public.get_auth_company_id()
            OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
          )';
    END IF;
END $$;

-- MARKETING CONVERSATIONS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'marketing_conversations') THEN
        DROP POLICY IF EXISTS marketing_conversations_tenant_policy ON public.marketing_conversations;
        EXECUTE 'CREATE POLICY marketing_conversations_tenant_policy ON public.marketing_conversations FOR ALL TO authenticated
          USING (
            company_id = public.get_auth_company_id()
            OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
          )
          WITH CHECK (
            company_id = public.get_auth_company_id()
            OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
          )';
    END IF;
END $$;

-- MARKETING MESSAGES
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'marketing_messages') AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'marketing_conversations') THEN
        DROP POLICY IF EXISTS marketing_messages_tenant_policy ON public.marketing_messages;
        EXECUTE 'CREATE POLICY marketing_messages_tenant_policy ON public.marketing_messages FOR ALL TO authenticated
          USING (
            conversation_id IN (
              SELECT mc.id FROM public.marketing_conversations mc
              WHERE mc.company_id = public.get_auth_company_id()
                 OR mc.company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
            )
          )
          WITH CHECK (
            conversation_id IN (
              SELECT mc.id FROM public.marketing_conversations mc
              WHERE mc.company_id = public.get_auth_company_id()
                 OR mc.company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
            )
          )';
    END IF;
END $$;

-- CRM PROJECTS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_projects') THEN
        DROP POLICY IF EXISTS crm_projects_strict_company ON public.crm_projects;
        EXECUTE 'CREATE POLICY crm_projects_strict_company ON public.crm_projects FOR ALL TO authenticated
          USING (
            company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
            OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())))
          WITH CHECK (
            company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
            OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())))';
    END IF;
END $$;

-- CRM TASKS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_tasks') AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_projects') THEN
        DROP POLICY IF EXISTS crm_tasks_strict_company ON public.crm_tasks;
        EXECUTE 'CREATE POLICY crm_tasks_strict_company ON public.crm_tasks FOR ALL TO authenticated
          USING (
            project_id IN (
              SELECT id FROM public.crm_projects 
              WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
                 OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
            )
          )
          WITH CHECK (
            project_id IN (
              SELECT id FROM public.crm_projects 
              WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
                 OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
            )
          )';
    END IF;
END $$;
