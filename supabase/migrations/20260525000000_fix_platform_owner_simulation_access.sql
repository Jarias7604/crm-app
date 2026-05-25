-- ================================================================
-- FIX: Restaurar acceso del platform_owner para modo simulación
-- PROBLEMA: La migración del 2026-04-22 eliminó el bypass de super_admin
--   correctamente por seguridad multi-tenant, PERO también rompió al
--   platform_owner que necesita acceder a cualquier empresa para simular.
-- SOLUCIÓN: Policy separada SOLO para is_platform_owner = true
--   (no es un bypass general para super_admin — solo el dueño de plataforma)
-- Fecha: 2026-05-25
-- ================================================================

-- LEADS: platform_owner puede ver leads de cualquier empresa
DROP POLICY IF EXISTS leads_platform_owner ON leads;
CREATE POLICY leads_platform_owner ON leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_platform_owner = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_platform_owner = true
    )
  );

-- MARKETING_CAMPAIGNS: platform_owner puede ver/editar campañas de cualquier empresa
DROP POLICY IF EXISTS marketing_campaigns_platform_owner ON marketing_campaigns;
CREATE POLICY marketing_campaigns_platform_owner ON marketing_campaigns
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_platform_owner = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_platform_owner = true
    )
  );

-- MARKETING_CONVERSATIONS: platform_owner accede para ver audiencia
DROP POLICY IF EXISTS marketing_conversations_platform_owner ON marketing_conversations;
CREATE POLICY marketing_conversations_platform_owner ON marketing_conversations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_platform_owner = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_platform_owner = true
    )
  );

-- COMPANIES: platform_owner puede ver todas las empresas (requerido para la simulación)
DROP POLICY IF EXISTS companies_platform_owner ON companies;
CREATE POLICY companies_platform_owner ON companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_platform_owner = true
    )
  );
