-- ================================================================
-- SECURITY SHIELD: Activar RLS en tablas públicas
-- Proyecto: CRM App Production (ikofyypxphrqkncimszt)
-- ================================================================

-- 1. Activar RLS en spatial_ref_sys si existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'spatial_ref_sys') THEN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'spatial_ref_sys' AND policyname = 'spatial_ref_sys_public_readonly'
    ) THEN
      CREATE POLICY spatial_ref_sys_public_readonly ON public.spatial_ref_sys
        FOR SELECT USING (true);
    END IF;
  END IF;
END $$;

-- 2. Blindar vistas con SECURITY INVOKER
DO $$
BEGIN
  BEGIN
    ALTER VIEW public.agent_cockpit_metrics SET (security_invoker = true);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    ALTER VIEW public.v_status_changes SET (security_invoker = true);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
