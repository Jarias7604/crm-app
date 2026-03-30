-- ================================================================
-- PHASE 9: Fix Notification Recipients & Leads RLS Role-Based
-- Fecha: 2026-03-30
-- Problema 1: Follow-up reminders llegaban a todos los usuarios
--             de la empresa en vez de solo al asignado + admins.
--             Jimmy (2 perfiles) recibía 2 notificaciones.
-- Problema 2: Sales agents veían todos los leads de la empresa
--             en vez de solo los leads asignados a ellos.
-- ================================================================

-- ----------------------------------------------------------------
-- FIX 1: get_notification_recipients
-- Reglas:
--   - sales_agent  → SOLO si es el assigned_to del follow-up
--   - company_admin → todas las notificaciones de su empresa
--   - super_admin   → todas las notificaciones de su empresa
--   - Deduplicado por (full_name, role) → 1 notif por persona
--     aunque tenga 2 perfiles (email corporativo + personal)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_notification_recipients(
  p_lead_id    uuid,
  p_company_id uuid,
  p_assigned_to uuid
)
RETURNS TABLE(recipient_id uuid, recipient_role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT DISTINCT ON (p.full_name, p.role) p.id, p.role::text
  FROM public.profiles p
  WHERE p.company_id = p_company_id          -- SIEMPRE mismo tenant
    AND p.is_active = true
    AND (
      -- sales_agent: SOLO si es el responsable asignado
      (p.role = 'sales_agent' AND p.id = p_assigned_to)
      -- company_admin: ve todas las notificaciones de su empresa
      OR p.role = 'company_admin'
      -- super_admin: ve todas las notificaciones de su empresa
      OR p.role = 'super_admin'
    )
  -- Para el DISTINCT ON: priorizar email corporativo sobre personal
  ORDER BY
    p.full_name,
    p.role,
    CASE
      WHEN p.email LIKE '%gmail.com'   THEN 2
      WHEN p.email LIKE '%hotmail.com' THEN 2
      WHEN p.email LIKE '%yahoo.com'   THEN 2
      ELSE 0  -- Email corporativo = prioridad
    END ASC;
$$;

-- ----------------------------------------------------------------
-- FIX 2: Leads RLS — visibilidad por rol
-- Eliminar política genérica anterior y reemplazar con 2 policies
-- basadas en rol del usuario autenticado.
-- ----------------------------------------------------------------

-- Limpiar políticas anteriores
DROP POLICY IF EXISTS "leads_v4_all"     ON public.leads;
DROP POLICY IF EXISTS "leads_collab_own" ON public.leads;
DROP POLICY IF EXISTS "leads_admin_all"  ON public.leads;

-- Política A: Admins ven y gestionan TODOS los leads de su empresa
CREATE POLICY "leads_admin_all"
  ON public.leads
  FOR ALL
  TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND (
      (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1)
      IN ('super_admin', 'company_admin')
    )
  )
  WITH CHECK (
    company_id = get_auth_company_id()
    AND (
      (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1)
      IN ('super_admin', 'company_admin')
    )
  );

-- Política B: Sales agents solo ven los leads asignados a ellos
CREATE POLICY "leads_collab_own"
  ON public.leads
  FOR ALL
  TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND assigned_to = auth.uid()
    AND (
      (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1)
      = 'sales_agent'
    )
  )
  WITH CHECK (
    company_id = get_auth_company_id()
    AND assigned_to = auth.uid()
    AND (
      (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1)
      = 'sales_agent'
    )
  );

-- ----------------------------------------------------------------
-- VERIFICACIÓN POST-MIGRACIÓN (ejecutar manualmente):
-- SELECT * FROM public.crm_rls_health_check();
-- SELECT COUNT(*) FROM leads WHERE company_id = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';
-- ----------------------------------------------------------------
