-- ================================================================
-- MIGRACIÓN: Agregar política de inserción (INSERT) para client_stage_comments
--
-- PROBLEMA: Se definió select/update/delete en 20260422192000_fix_rls_superadmin_bypass_all_crm_tables.sql
--   pero se omitió la política de inserción, provocando violación de RLS en clientes.
--
-- SOLUCIÓN: Crear política csc_insert para permitir inserts a usuarios autenticados
--   que pertenezcan a la misma compañía (company_id) y usen su propio uid (created_by).
--
-- FECHA: 2026-06-17
-- ================================================================

DROP POLICY IF EXISTS csc_insert ON public.client_stage_comments;
CREATE POLICY csc_insert ON public.client_stage_comments FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_auth_company_id()
    AND created_by = auth.uid()
  );
