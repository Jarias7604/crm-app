-- ================================================================
-- HOTFIX SEGURIDAD: Eliminar bypass super_admin en TODAS las tablas
-- Ningún usuario puede ver datos de otro tenant, incluyendo super_admin
-- Tablas afectadas: 31
-- Aplicado a producción: 2026-04-22
-- ================================================================

-- 1. clients
DROP POLICY IF EXISTS company_access ON clients;
CREATE POLICY company_access ON clients FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 2. client_pipeline_stages
DROP POLICY IF EXISTS company_access ON client_pipeline_stages;
CREATE POLICY company_access ON client_pipeline_stages FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 3. client_stage_document_types
DROP POLICY IF EXISTS company_access ON client_stage_document_types;
CREATE POLICY company_access ON client_stage_document_types FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 4. client_stage_comments - select
DROP POLICY IF EXISTS csc_select ON client_stage_comments;
CREATE POLICY csc_select ON client_stage_comments FOR SELECT TO authenticated
  USING (company_id = get_auth_company_id());

-- 5. client_stage_comments - delete
DROP POLICY IF EXISTS csc_delete ON client_stage_comments;
CREATE POLICY csc_delete ON client_stage_comments FOR DELETE TO authenticated
  USING (
    (created_by = auth.uid())
    OR (
      company_id = get_auth_company_id()
      AND (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid() LIMIT 1)
          = ANY (ARRAY['company_admin'::app_role, 'super_admin'::app_role])
    )
  );

-- 6. client_stage_comments - update
DROP POLICY IF EXISTS csc_update ON client_stage_comments;
CREATE POLICY csc_update ON client_stage_comments FOR UPDATE TO authenticated
  USING (
    (created_by = auth.uid())
    OR (
      company_id = get_auth_company_id()
      AND (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid() LIMIT 1)
          = ANY (ARRAY['company_admin'::app_role, 'super_admin'::app_role])
    )
  )
  WITH CHECK (
    (created_by = auth.uid())
    OR (
      company_id = get_auth_company_id()
      AND (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid() LIMIT 1)
          = ANY (ARRAY['company_admin'::app_role, 'super_admin'::app_role])
    )
  );

-- 7. client_documents - delete
DROP POLICY IF EXISTS cd_delete ON client_documents;
CREATE POLICY cd_delete ON client_documents FOR DELETE TO authenticated
  USING (company_id = get_auth_company_id());

-- 8. call_goals
DROP POLICY IF EXISTS call_goals_tenant_policy ON call_goals;
CREATE POLICY call_goals_tenant_policy ON call_goals FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 9. companies - select
DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies FOR SELECT TO authenticated
  USING (id = get_auth_company_id());

-- 10. companies - update
DROP POLICY IF EXISTS companies_update ON companies;
CREATE POLICY companies_update ON companies FOR UPDATE TO authenticated
  USING (id = get_auth_company_id())
  WITH CHECK (id = get_auth_company_id());

-- 11. company_invitations
DROP POLICY IF EXISTS company_invitations_tenant_policy ON company_invitations;
CREATE POLICY company_invitations_tenant_policy ON company_invitations FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 12. custom_roles
DROP POLICY IF EXISTS custom_roles_tenant_policy ON custom_roles;
CREATE POLICY custom_roles_tenant_policy ON custom_roles FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 13. financing_plans
DROP POLICY IF EXISTS financing_plans_read ON financing_plans;
CREATE POLICY financing_plans_read ON financing_plans FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_auth_company_id());

DROP POLICY IF EXISTS financing_plans_delete ON financing_plans;
CREATE POLICY financing_plans_delete ON financing_plans FOR DELETE TO authenticated
  USING (company_id = get_auth_company_id());

DROP POLICY IF EXISTS financing_plans_update ON financing_plans;
CREATE POLICY financing_plans_update ON financing_plans FOR UPDATE TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 14. marketing_ai_agents
DROP POLICY IF EXISTS hubspot_style_marketing_agents_isolation ON marketing_ai_agents;
CREATE POLICY hubspot_style_marketing_agents_isolation ON marketing_ai_agents FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- 15. marketing_conversations
DROP POLICY IF EXISTS marketing_conversations_tenant_policy ON marketing_conversations;
CREATE POLICY marketing_conversations_tenant_policy ON marketing_conversations FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 16. marketing_integrations (contiene API keys — muy sensible)
DROP POLICY IF EXISTS marketing_integrations_tenant_policy ON marketing_integrations;
CREATE POLICY marketing_integrations_tenant_policy ON marketing_integrations FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 17. marketing_lead_searches
DROP POLICY IF EXISTS marketing_lead_searches_tenant_policy ON marketing_lead_searches;
CREATE POLICY marketing_lead_searches_tenant_policy ON marketing_lead_searches FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 18. marketing_messages
DROP POLICY IF EXISTS marketing_messages_tenant_policy ON marketing_messages;
CREATE POLICY marketing_messages_tenant_policy ON marketing_messages FOR ALL TO authenticated
  USING (
    conversation_id IN (
      SELECT mc.id FROM marketing_conversations mc
      WHERE mc.company_id = get_auth_company_id()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT mc.id FROM marketing_conversations mc
      WHERE mc.company_id = get_auth_company_id()
    )
  );

-- 19. marketing_templates
DROP POLICY IF EXISTS marketing_templates_tenant_policy ON marketing_templates;
CREATE POLICY marketing_templates_tenant_policy ON marketing_templates FOR ALL TO authenticated
  USING (company_id IS NULL OR company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 20. password_reset_log
DROP POLICY IF EXISTS super_admin_read ON password_reset_log;
DROP POLICY IF EXISTS password_reset_log_read ON password_reset_log;
CREATE POLICY password_reset_log_read ON password_reset_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p_caller
      JOIN profiles p_target ON p_target.id = password_reset_log.target_user_id
      WHERE p_caller.id = auth.uid()
      AND p_caller.role IN ('super_admin'::app_role, 'company_admin'::app_role)
      AND p_caller.company_id = p_target.company_id
    )
  );

-- 21. payment_settings
DROP POLICY IF EXISTS payment_settings_tenant_policy ON payment_settings;
CREATE POLICY payment_settings_tenant_policy ON payment_settings FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 22. performance_goals
DROP POLICY IF EXISTS performance_goals_tenant_policy ON performance_goals;
CREATE POLICY performance_goals_tenant_policy ON performance_goals FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 23. profiles
DROP POLICY IF EXISTS profiles_tenant_policy ON profiles;
CREATE POLICY profiles_tenant_policy ON profiles FOR ALL TO authenticated
  USING (
    (id = auth.uid()) OR (company_id = get_auth_company_id())
  )
  WITH CHECK (
    (id = auth.uid()) OR (company_id = get_auth_company_id())
  );

-- 24. role_permissions
DROP POLICY IF EXISTS role_permissions_tenant_policy ON role_permissions;
CREATE POLICY role_permissions_tenant_policy ON role_permissions FOR ALL TO authenticated
  USING (
    role_id IN (SELECT cr.id FROM custom_roles cr WHERE cr.company_id = get_auth_company_id())
  )
  WITH CHECK (
    role_id IN (SELECT cr.id FROM custom_roles cr WHERE cr.company_id = get_auth_company_id())
  );

-- 25. sales_forecast
DROP POLICY IF EXISTS sales_forecast_tenant_policy ON sales_forecast;
CREATE POLICY sales_forecast_tenant_policy ON sales_forecast FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 26. sales_goals
DROP POLICY IF EXISTS sales_goals_tenant_policy ON sales_goals;
CREATE POLICY sales_goals_tenant_policy ON sales_goals FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 27. team_members
DROP POLICY IF EXISTS team_members_tenant_policy ON team_members;
CREATE POLICY team_members_tenant_policy ON team_members FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND t.company_id = get_auth_company_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND t.company_id = get_auth_company_id())
  );

-- 28. ticket_categories
DROP POLICY IF EXISTS ticket_categories_tenant_policy ON ticket_categories;
CREATE POLICY ticket_categories_tenant_policy ON ticket_categories FOR ALL TO authenticated
  USING (company_id = get_auth_company_id())
  WITH CHECK (company_id = get_auth_company_id());

-- 29. ticket_updates
DROP POLICY IF EXISTS "Users can view updates from their company" ON ticket_updates;
CREATE POLICY "Users can view updates from their company" ON ticket_updates FOR SELECT TO authenticated
  USING (
    ticket_id IN (SELECT tickets.id FROM tickets WHERE tickets.company_id = get_my_company_v4())
  );

-- 30. loss_reasons
DROP POLICY IF EXISTS loss_reasons_tenant_policy ON loss_reasons;
CREATE POLICY loss_reasons_tenant_policy ON loss_reasons FOR ALL TO authenticated
  USING (company_id = get_auth_company_id() OR company_id IS NULL)
  WITH CHECK (company_id = get_auth_company_id());

-- 31. contractor_profiles
DROP POLICY IF EXISTS cp_self_update ON contractor_profiles;
CREATE POLICY cp_self_update ON contractor_profiles FOR UPDATE TO authenticated
  USING (
    (profile_id = auth.uid())
    OR (
      company_id = get_auth_company_id()
      AND (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid() LIMIT 1)
          = ANY (ARRAY['super_admin'::app_role, 'company_admin'::app_role])
    )
  )
  WITH CHECK (
    (profile_id = auth.uid())
    OR (
      company_id = get_auth_company_id()
      AND (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid() LIMIT 1)
          = ANY (ARRAY['super_admin'::app_role, 'company_admin'::app_role])
    )
  );
