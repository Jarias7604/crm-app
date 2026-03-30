-- ================================================================
-- PHASE 10: RBAC Completo — Aislamiento Total por Rol
-- Fecha: 2026-03-30
--
-- ARQUITECTURA DE PERMISOS:
--
--   super_admin   → ve TODA la empresa (leads, follow-ups, cotizaciones, etc.)
--   company_admin → ve TODA la empresa (misma empresa)
--   sales_agent   → ve SOLO sus registros asignados o creados por él
--
-- TABLAS CORREGIDAS:
--   follow_ups, call_activities, cotizaciones, tickets
--
-- PRINCIPIO: "Escribe la regla de negocio directamente en la DB.
--             El frontend filtra además, pero la DB es la última
--             línea de defensa. Nunca confiar solo en el frontend."
-- ================================================================

-- ================================================================
-- HELPER: Función para verificar si el usuario es admin de empresa
-- Evita subqueries repetidas en cada policy (performance)
-- ================================================================
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

-- ================================================================
-- TABLE: follow_ups
--
-- Reglas:
--   admin → todos los follow-ups de su empresa
--   sales_agent → solo donde assigned_to = él o user_id (creador) = él
-- ================================================================
DROP POLICY IF EXISTS "follow_ups_tenant_policy" ON public.follow_ups;
DROP POLICY IF EXISTS "follow_ups_admin_all"      ON public.follow_ups;
DROP POLICY IF EXISTS "follow_ups_agent_own"      ON public.follow_ups;

-- Admins: todos los follow-ups de su empresa
CREATE POLICY "follow_ups_admin_all"
  ON public.follow_ups
  FOR ALL
  TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND is_company_manager()
  )
  WITH CHECK (
    company_id = get_auth_company_id()
    AND is_company_manager()
  );

-- Sales agents: solo sus follow-ups (asignados a ellos o creados por ellos)
CREATE POLICY "follow_ups_agent_own"
  ON public.follow_ups
  FOR ALL
  TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND NOT is_company_manager()
    AND (
      assigned_to = auth.uid()
      OR user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = get_auth_company_id()
    AND NOT is_company_manager()
    AND (
      assigned_to = auth.uid()
      OR user_id = auth.uid()
    )
  );

-- ================================================================
-- TABLE: call_activities
--
-- Reglas:
--   admin → todas las llamadas de su empresa
--   sales_agent → solo las llamadas que él realizó (user_id)
-- ================================================================
DROP POLICY IF EXISTS "call_activities_tenant_policy" ON public.call_activities;
DROP POLICY IF EXISTS "call_activities_admin_all"      ON public.call_activities;
DROP POLICY IF EXISTS "call_activities_agent_own"      ON public.call_activities;

-- Admins
CREATE POLICY "call_activities_admin_all"
  ON public.call_activities
  FOR ALL
  TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND is_company_manager()
  )
  WITH CHECK (
    company_id = get_auth_company_id()
    AND is_company_manager()
  );

-- Sales agents: solo sus llamadas
CREATE POLICY "call_activities_agent_own"
  ON public.call_activities
  FOR ALL
  TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND NOT is_company_manager()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    company_id = get_auth_company_id()
    AND NOT is_company_manager()
    AND user_id = auth.uid()
  );

-- ================================================================
-- TABLE: cotizaciones (Quotes)
--
-- Reglas:
--   admin → todas las cotizaciones de su empresa
--   sales_agent → solo las que él creó
--   PUBLIC (anon) → mantener acceso para links públicos compartidos
-- ================================================================
DROP POLICY IF EXISTS "cotizaciones_tenant_policy"   ON public.cotizaciones;
DROP POLICY IF EXISTS "cotizaciones_admin_all"        ON public.cotizaciones;
DROP POLICY IF EXISTS "cotizaciones_agent_own"        ON public.cotizaciones;
-- NOTA: Conservamos "Public read for shared quotes" (USING true) para links públicos

-- Admins
CREATE POLICY "cotizaciones_admin_all"
  ON public.cotizaciones
  FOR ALL
  TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND is_company_manager()
  )
  WITH CHECK (
    company_id = get_auth_company_id()
    AND is_company_manager()
  );

-- Sales agents: solo las cotizaciones que crearon
CREATE POLICY "cotizaciones_agent_own"
  ON public.cotizaciones
  FOR ALL
  TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND NOT is_company_manager()
    AND created_by = auth.uid()
  )
  WITH CHECK (
    company_id = get_auth_company_id()
    AND NOT is_company_manager()
    AND created_by = auth.uid()
  );

-- ================================================================
-- TABLE: tickets (Service Hub)
--
-- Reglas:
--   admin → todos los tickets de su empresa
--   sales_agent → tickets asignados a él o creados por él
-- ================================================================
DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert" ON public.tickets;
DROP POLICY IF EXISTS "tickets_update" ON public.tickets;
DROP POLICY IF EXISTS "tickets_delete" ON public.tickets;
DROP POLICY IF EXISTS "tickets_admin_all" ON public.tickets;
DROP POLICY IF EXISTS "tickets_agent_own" ON public.tickets;

-- Admins: todos los tickets
CREATE POLICY "tickets_admin_all"
  ON public.tickets
  FOR ALL
  TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND is_company_manager()
  )
  WITH CHECK (
    company_id = get_auth_company_id()
    AND is_company_manager()
  );

-- Sales agents: tickets asignados o creados por ellos
CREATE POLICY "tickets_agent_own"
  ON public.tickets
  FOR ALL
  TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND NOT is_company_manager()
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
    )
  )
  WITH CHECK (
    company_id = get_auth_company_id()
    AND NOT is_company_manager()
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
    )
  );

-- ================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ================================================================
-- 1. Listar todas las policies activas en tablas afectadas:
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies WHERE schemaname='public'
-- AND tablename IN ('follow_ups','call_activities','cotizaciones','tickets')
-- ORDER BY tablename, cmd;
--
-- 2. Simular acceso de Melvin (sales_agent):
-- SELECT COUNT(*) FROM follow_ups WHERE company_id='7a582ba5-...' AND (assigned_to='160a23cb-...' OR user_id='160a23cb-...');
-- SELECT COUNT(*) FROM call_activities WHERE company_id='7a582ba5-...' AND user_id='160a23cb-...';
-- ================================================================
