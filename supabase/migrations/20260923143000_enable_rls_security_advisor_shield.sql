-- ================================================================
-- SECURITY SHIELD: Activar RLS en todas las tablas públicas
-- Resuelve: Supabase Security Advisor (rls_disabled_in_public)
-- Fecha: 2026-09-23
-- ================================================================

-- 1. Activar Row-Level Security en las 4 tablas públicas
ALTER TABLE IF EXISTS public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_request_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.request_status_history ENABLE ROW LEVEL SECURITY;

-- 2. Crear políticas multi-tenant seguras
DO $$
BEGIN
  -- service_requests
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_requests' AND policyname = 'service_requests_tenant_isolation'
  ) THEN
    CREATE POLICY service_requests_tenant_isolation ON public.service_requests
      FOR ALL TO authenticated
      USING (company_id = get_auth_company_id())
      WITH CHECK (company_id = get_auth_company_id());
  END IF;

  -- service_request_quotes
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_request_quotes' AND policyname = 'service_request_quotes_tenant_isolation'
  ) THEN
    CREATE POLICY service_request_quotes_tenant_isolation ON public.service_request_quotes
      FOR ALL TO authenticated
      USING (request_id IN (SELECT id FROM public.service_requests WHERE company_id = get_auth_company_id()))
      WITH CHECK (request_id IN (SELECT id FROM public.service_requests WHERE company_id = get_auth_company_id()));
  END IF;

  -- request_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'request_messages' AND policyname = 'request_messages_tenant_isolation'
  ) THEN
    CREATE POLICY request_messages_tenant_isolation ON public.request_messages
      FOR ALL TO authenticated
      USING (request_id IN (SELECT id FROM public.service_requests WHERE company_id = get_auth_company_id()))
      WITH CHECK (request_id IN (SELECT id FROM public.service_requests WHERE company_id = get_auth_company_id()));
  END IF;

  -- request_status_history
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'request_status_history' AND policyname = 'request_status_history_tenant_isolation'
  ) THEN
    CREATE POLICY request_status_history_tenant_isolation ON public.request_status_history
      FOR ALL TO authenticated
      USING (request_id IN (SELECT id FROM public.service_requests WHERE company_id = get_auth_company_id()))
      WITH CHECK (request_id IN (SELECT id FROM public.service_requests WHERE company_id = get_auth_company_id()));
  END IF;
END $$;

-- 3. Blindar vistas con SECURITY INVOKER
DO $$
BEGIN
  BEGIN
    ALTER VIEW public.v_status_changes SET (security_invoker = true);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER VIEW public.agent_cockpit_metrics SET (security_invoker = true);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- 4. Disparador permanente de eventos (Autodefensa para cualquier tabla futura)
DO $$
BEGIN
  BEGIN
    CREATE OR REPLACE FUNCTION public.pgrst_auto_enable_rls()
    RETURNS event_trigger
    LANGUAGE plpgsql
    AS $fn$
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE'
        LOOP
            IF r.schema_name = 'public' THEN
                EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', r.schema_name, r.objid::regclass);
            END IF;
        END LOOP;
    END;
    $fn$;

    DROP EVENT TRIGGER IF EXISTS trg_pgrst_auto_enable_rls;
    CREATE EVENT TRIGGER trg_pgrst_auto_enable_rls
    ON ddl_command_end
    WHEN TAG IN ('CREATE TABLE')
    EXECUTE FUNCTION public.pgrst_auto_enable_rls();
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
