-- ================================================================
-- FIX: Definir políticas RLS completas para la tabla teams
-- Fecha: 2026-07-01
-- Problema: "new row violates row-level security policy for table "teams""
-- Contexto: La tabla teams tiene RLS habilitado pero solo tenía una política
--           para SELECT, bloqueando INSERT/UPDATE/DELETE para usuarios normales.
-- Solución: Reemplazar por políticas seguras basadas en company_id
--           y parent_company_id (sub-workspaces).
-- ================================================================

-- 1. Asegurar que RLS está habilitado en teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes en teams
DROP POLICY IF EXISTS teams_select ON public.teams;
DROP POLICY IF EXISTS teams_insert ON public.teams;
DROP POLICY IF EXISTS teams_update ON public.teams;
DROP POLICY IF EXISTS teams_delete ON public.teams;

-- 3. Crear política SELECT (scopeda a la empresa del usuario o sub-empresas)
CREATE POLICY teams_select ON public.teams
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (
      SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()
    )
  );

-- 4. Crear política INSERT (permite crear equipos para su propia empresa o sub-empresas)
CREATE POLICY teams_insert ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (
      SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()
    )
  );

-- 5. Crear política UPDATE (permite actualizar equipos de su propia empresa o sub-empresas)
CREATE POLICY teams_update ON public.teams
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (
      SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()
    )
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (
      SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()
    )
  );

-- 6. Crear política DELETE (permite eliminar equipos de su propia empresa o sub-empresas)
CREATE POLICY teams_delete ON public.teams
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (
      SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()
    )
  );

-- 7. Verificar políticas creadas
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'teams' ORDER BY cmd;
