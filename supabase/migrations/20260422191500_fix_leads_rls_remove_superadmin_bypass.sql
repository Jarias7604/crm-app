-- ============================================================
-- HOTFIX SEGURIDAD: Eliminar bypass super_admin en leads
-- PROBLEMA: super_admin podía ver leads de TODOS los tenants
-- SOLUCIÓN: Limitar a company_id = get_auth_company_id() para todos
-- Aplicado a producción: 2026-04-22
-- ============================================================

DROP POLICY IF EXISTS leads_admin_all ON leads;

CREATE POLICY leads_admin_all ON leads
  FOR ALL
  TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND (
      ( SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid() LIMIT 1 )
      IN ('super_admin'::app_role, 'company_admin'::app_role)
    )
  )
  WITH CHECK (
    company_id = get_auth_company_id()
    AND (
      ( SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid() LIMIT 1 )
      IN ('super_admin'::app_role, 'company_admin'::app_role)
    )
  );
