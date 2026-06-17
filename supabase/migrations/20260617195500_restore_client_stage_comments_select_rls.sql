-- ================================================================
-- MIGRACIÓN: Restaurar políticas csc_select y csc_insert para client_stage_comments
--
-- CAUSA: El incidente del 2026-06-08 (DROP FUNCTION CASCADE) eliminó silenciosamente
--   las políticas de client_stage_comments. El restore script no las recuperó,
--   dejando la tabla sin política SELECT (lo que oculta comentarios y hace fallar
--   la inserción al no poder retornar la fila insertada).
--
-- SOLUCIÓN: Recrear las políticas SELECT e INSERT con validación de company_id.
-- ================================================================

-- 1. client_stage_comments - select
DROP POLICY IF EXISTS csc_select ON public.client_stage_comments;
CREATE POLICY csc_select ON public.client_stage_comments FOR SELECT TO authenticated
  USING (company_id = get_auth_company_id());

-- 2. client_stage_comments - insert
DROP POLICY IF EXISTS csc_insert ON public.client_stage_comments;
CREATE POLICY csc_insert ON public.client_stage_comments FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_auth_company_id()
    AND created_by = auth.uid()
  );
