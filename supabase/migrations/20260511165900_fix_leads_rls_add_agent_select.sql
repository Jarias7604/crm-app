-- ============================================================
-- HOTFIX: Restaurar lectura de leads para sales_agent
-- CAUSA: migración 20260422191500 eliminó la política anterior
--        y la nueva solo incluyó super_admin y company_admin,
--        dejando a sales_agent sin acceso a leer leads.
-- IMPACTO: Gerson y cualquier sales_agent no podían ver
--          clientes/leads en el módulo de Tickets (Service Hub).
-- SOLUCIÓN: Política separada FOR SELECT que permite a todos
--           los usuarios autenticados de la misma empresa
--           leer los leads de su company_id.
-- Aplicado a producción: 2026-05-11
-- Proyecto: ikofyypxphrqkncimszt
-- ============================================================

-- Eliminar si ya existe (idempotente)
DROP POLICY IF EXISTS "leads_agent_select" ON public.leads;

-- Política de solo lectura para cualquier miembro autenticado de la empresa
-- La escritura/modificación sigue controlada por leads_admin_all (solo admins)
CREATE POLICY "leads_agent_select"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    company_id = get_auth_company_id()
  );
