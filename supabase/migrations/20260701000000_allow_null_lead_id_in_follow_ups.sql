-- ================================================================
-- FIX: Permitir follow_ups sin lead_id (reuniones de calendario)
-- Fecha: 2026-07-01
-- Problema: "null value in column lead_id violates not-null constraint"
-- Contexto: Al crear reuniones desde el Calendario sin asociar un lead,
--           el INSERT falla porque lead_id es NOT NULL.
-- Solución: Hacer lead_id nullable + actualizar RLS para usar company_id
--           directamente cuando lead_id es NULL.
-- ================================================================

-- 1. Hacer lead_id opcional en follow_ups
ALTER TABLE public.follow_ups
  ALTER COLUMN lead_id DROP NOT NULL;

-- 2. Actualizar RLS de follow_ups para soportar lead_id NULL
--    La política actual requiere lead_id para resolver company_id.
--    La nueva política acepta registros donde company_id coincide directamente
--    O donde lead_id apunta a un lead de la misma empresa.

-- SELECT policy
DROP POLICY IF EXISTS follow_ups_company_scoped_select ON public.follow_ups;
DROP POLICY IF EXISTS follow_ups_select ON public.follow_ups;
DROP POLICY IF EXISTS "Users can view follow ups" ON public.follow_ups;
DROP POLICY IF EXISTS follow_ups_tenant_policy ON public.follow_ups;

CREATE POLICY follow_ups_select ON public.follow_ups
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR (
      lead_id IS NOT NULL
      AND lead_id IN (
        SELECT id FROM public.leads WHERE company_id = public.get_auth_company_id()
      )
    )
  );

-- INSERT policy
DROP POLICY IF EXISTS follow_ups_company_scoped_insert ON public.follow_ups;
DROP POLICY IF EXISTS follow_ups_insert ON public.follow_ups;
DROP POLICY IF EXISTS "Users can insert follow ups" ON public.follow_ups;

CREATE POLICY follow_ups_insert ON public.follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_auth_company_id()
  );

-- UPDATE policy
DROP POLICY IF EXISTS follow_ups_update ON public.follow_ups;
DROP POLICY IF EXISTS "Users can update follow ups" ON public.follow_ups;

CREATE POLICY follow_ups_update ON public.follow_ups
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR (
      lead_id IS NOT NULL
      AND lead_id IN (
        SELECT id FROM public.leads WHERE company_id = public.get_auth_company_id()
      )
    )
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
  );

-- DELETE policy
DROP POLICY IF EXISTS follow_ups_delete ON public.follow_ups;
DROP POLICY IF EXISTS "Users can delete follow ups" ON public.follow_ups;

CREATE POLICY follow_ups_delete ON public.follow_ups
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR (
      lead_id IS NOT NULL
      AND lead_id IN (
        SELECT id FROM public.leads WHERE company_id = public.get_auth_company_id()
      )
    )
  );

-- 3. Asegurar que RLS está habilitado en follow_ups
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
