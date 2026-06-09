-- =================================================================
-- RECOVERY SCRIPT: Restore dropped RLS Policies due to CASCADE
-- Date: 2026-06-08
-- Description: Recreates all RLS policies referencing get_auth_company_id()
--              that were dropped when the function was dropped with CASCADE.
--              Includes support for parent-child workspaces.
-- =================================================================

-- --- Table: ticket_categories ---
DROP POLICY IF EXISTS "ticket_categories_tenant_policy" ON public."ticket_categories";
DROP POLICY IF EXISTS "ticket_categories_company_isolation" ON public."ticket_categories";
DROP POLICY IF EXISTS "company_access" ON public."ticket_categories";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."ticket_categories";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."ticket_categories";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."ticket_categories";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."ticket_categories";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."ticket_categories";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."ticket_categories";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."ticket_categories";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."ticket_categories";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."ticket_categories";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."ticket_categories";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."ticket_categories";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."ticket_categories";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."ticket_categories";
DROP POLICY IF EXISTS "cp_self_update" ON public."ticket_categories";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."ticket_categories";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."ticket_categories";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."ticket_categories";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."ticket_categories";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."ticket_categories";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."ticket_categories";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."ticket_categories";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."ticket_categories";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."ticket_categories";

CREATE POLICY "ticket_categories_tenant_policy" ON public."ticket_categories" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: tickets ---
DROP POLICY IF EXISTS "tickets_tenant_policy" ON public."tickets";
DROP POLICY IF EXISTS "tickets_company_isolation" ON public."tickets";
DROP POLICY IF EXISTS "company_access" ON public."tickets";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."tickets";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."tickets";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."tickets";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."tickets";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."tickets";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."tickets";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."tickets";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."tickets";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."tickets";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."tickets";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."tickets";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."tickets";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."tickets";
DROP POLICY IF EXISTS "cp_self_update" ON public."tickets";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."tickets";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."tickets";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."tickets";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."tickets";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."tickets";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."tickets";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."tickets";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."tickets";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."tickets";

CREATE POLICY "tickets_tenant_policy" ON public."tickets" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: ticket_comments ---
DROP POLICY IF EXISTS "ticket_comments_tenant_policy" ON public."ticket_comments";
DROP POLICY IF EXISTS "ticket_comments_company_isolation" ON public."ticket_comments";
DROP POLICY IF EXISTS "company_access" ON public."ticket_comments";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."ticket_comments";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."ticket_comments";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."ticket_comments";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."ticket_comments";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."ticket_comments";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."ticket_comments";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."ticket_comments";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."ticket_comments";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."ticket_comments";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."ticket_comments";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."ticket_comments";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."ticket_comments";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."ticket_comments";
DROP POLICY IF EXISTS "cp_self_update" ON public."ticket_comments";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."ticket_comments";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."ticket_comments";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."ticket_comments";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."ticket_comments";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."ticket_comments";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."ticket_comments";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."ticket_comments";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."ticket_comments";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."ticket_comments";

CREATE POLICY "ticket_comments_tenant_policy" ON public."ticket_comments" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: marketing_ai_agents ---
DROP POLICY IF EXISTS "marketing_ai_agents_tenant_policy" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "marketing_ai_agents_company_isolation" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "company_access" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "cp_self_update" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."marketing_ai_agents";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."marketing_ai_agents";

CREATE POLICY "marketing_ai_agents_tenant_policy" ON public."marketing_ai_agents" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: marketing_campaigns ---
DROP POLICY IF EXISTS "marketing_campaigns_tenant_policy" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "marketing_campaigns_company_isolation" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "company_access" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "cp_self_update" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."marketing_campaigns";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."marketing_campaigns";

CREATE POLICY "marketing_campaigns_tenant_policy" ON public."marketing_campaigns" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: client_stage_history ---
DROP POLICY IF EXISTS "client_stage_history_tenant_policy" ON public."client_stage_history";
DROP POLICY IF EXISTS "client_stage_history_company_isolation" ON public."client_stage_history";
DROP POLICY IF EXISTS "company_access" ON public."client_stage_history";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."client_stage_history";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."client_stage_history";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."client_stage_history";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."client_stage_history";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."client_stage_history";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."client_stage_history";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."client_stage_history";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."client_stage_history";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."client_stage_history";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."client_stage_history";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."client_stage_history";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."client_stage_history";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."client_stage_history";
DROP POLICY IF EXISTS "cp_self_update" ON public."client_stage_history";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."client_stage_history";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."client_stage_history";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."client_stage_history";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."client_stage_history";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."client_stage_history";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."client_stage_history";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."client_stage_history";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."client_stage_history";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."client_stage_history";

CREATE POLICY "client_stage_history_tenant_policy" ON public."client_stage_history" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: ai_followup_settings ---
DROP POLICY IF EXISTS "ai_followup_settings_tenant_policy" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "ai_followup_settings_company_isolation" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "company_access" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "cp_self_update" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."ai_followup_settings";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."ai_followup_settings";

CREATE POLICY "ai_followup_settings_tenant_policy" ON public."ai_followup_settings" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: custom_roles ---
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."custom_roles";
DROP POLICY IF EXISTS "custom_roles_company_isolation" ON public."custom_roles";
DROP POLICY IF EXISTS "company_access" ON public."custom_roles";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."custom_roles";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."custom_roles";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."custom_roles";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."custom_roles";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."custom_roles";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."custom_roles";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."custom_roles";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."custom_roles";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."custom_roles";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."custom_roles";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."custom_roles";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."custom_roles";
DROP POLICY IF EXISTS "cp_self_update" ON public."custom_roles";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."custom_roles";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."custom_roles";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."custom_roles";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."custom_roles";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."custom_roles";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."custom_roles";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."custom_roles";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."custom_roles";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."custom_roles";

CREATE POLICY "custom_roles_tenant_policy" ON public."custom_roles" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: financing_plans ---
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."financing_plans";
DROP POLICY IF EXISTS "financing_plans_company_isolation" ON public."financing_plans";
DROP POLICY IF EXISTS "company_access" ON public."financing_plans";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."financing_plans";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."financing_plans";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."financing_plans";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."financing_plans";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."financing_plans";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."financing_plans";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."financing_plans";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."financing_plans";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."financing_plans";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."financing_plans";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."financing_plans";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."financing_plans";
DROP POLICY IF EXISTS "cp_self_update" ON public."financing_plans";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."financing_plans";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."financing_plans";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."financing_plans";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."financing_plans";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."financing_plans";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."financing_plans";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."financing_plans";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."financing_plans";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."financing_plans";

CREATE POLICY "financing_plans_tenant_policy" ON public."financing_plans" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: company_invitations ---
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."company_invitations";
DROP POLICY IF EXISTS "company_invitations_company_isolation" ON public."company_invitations";
DROP POLICY IF EXISTS "company_access" ON public."company_invitations";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."company_invitations";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."company_invitations";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."company_invitations";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."company_invitations";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."company_invitations";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."company_invitations";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."company_invitations";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."company_invitations";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."company_invitations";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."company_invitations";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."company_invitations";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."company_invitations";
DROP POLICY IF EXISTS "cp_self_update" ON public."company_invitations";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."company_invitations";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."company_invitations";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."company_invitations";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."company_invitations";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."company_invitations";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."company_invitations";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."company_invitations";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."company_invitations";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."company_invitations";

CREATE POLICY "company_invitations_tenant_policy" ON public."company_invitations" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: marketing_lead_searches ---
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "marketing_lead_searches_company_isolation" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "company_access" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "cp_self_update" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."marketing_lead_searches";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."marketing_lead_searches";

CREATE POLICY "marketing_lead_searches_tenant_policy" ON public."marketing_lead_searches" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: marketing_templates ---
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."marketing_templates";
DROP POLICY IF EXISTS "marketing_templates_company_isolation" ON public."marketing_templates";
DROP POLICY IF EXISTS "company_access" ON public."marketing_templates";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."marketing_templates";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."marketing_templates";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."marketing_templates";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."marketing_templates";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."marketing_templates";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."marketing_templates";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."marketing_templates";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."marketing_templates";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."marketing_templates";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."marketing_templates";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."marketing_templates";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."marketing_templates";
DROP POLICY IF EXISTS "cp_self_update" ON public."marketing_templates";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."marketing_templates";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."marketing_templates";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."marketing_templates";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."marketing_templates";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."marketing_templates";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."marketing_templates";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."marketing_templates";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."marketing_templates";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."marketing_templates";

CREATE POLICY "marketing_templates_tenant_policy" ON public."marketing_templates" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: payment_settings ---
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."payment_settings";
DROP POLICY IF EXISTS "payment_settings_company_isolation" ON public."payment_settings";
DROP POLICY IF EXISTS "company_access" ON public."payment_settings";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."payment_settings";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."payment_settings";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."payment_settings";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."payment_settings";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."payment_settings";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."payment_settings";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."payment_settings";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."payment_settings";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."payment_settings";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."payment_settings";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."payment_settings";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."payment_settings";
DROP POLICY IF EXISTS "cp_self_update" ON public."payment_settings";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."payment_settings";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."payment_settings";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."payment_settings";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."payment_settings";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."payment_settings";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."payment_settings";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."payment_settings";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."payment_settings";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."payment_settings";

CREATE POLICY "payment_settings_tenant_policy" ON public."payment_settings" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: performance_goals ---
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."performance_goals";
DROP POLICY IF EXISTS "performance_goals_company_isolation" ON public."performance_goals";
DROP POLICY IF EXISTS "company_access" ON public."performance_goals";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."performance_goals";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."performance_goals";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."performance_goals";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."performance_goals";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."performance_goals";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."performance_goals";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."performance_goals";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."performance_goals";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."performance_goals";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."performance_goals";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."performance_goals";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."performance_goals";
DROP POLICY IF EXISTS "cp_self_update" ON public."performance_goals";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."performance_goals";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."performance_goals";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."performance_goals";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."performance_goals";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."performance_goals";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."performance_goals";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."performance_goals";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."performance_goals";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."performance_goals";

CREATE POLICY "performance_goals_tenant_policy" ON public."performance_goals" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: sales_forecast ---
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."sales_forecast";
DROP POLICY IF EXISTS "sales_forecast_company_isolation" ON public."sales_forecast";
DROP POLICY IF EXISTS "company_access" ON public."sales_forecast";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."sales_forecast";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."sales_forecast";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."sales_forecast";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."sales_forecast";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."sales_forecast";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."sales_forecast";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."sales_forecast";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."sales_forecast";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."sales_forecast";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."sales_forecast";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."sales_forecast";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."sales_forecast";
DROP POLICY IF EXISTS "cp_self_update" ON public."sales_forecast";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."sales_forecast";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."sales_forecast";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."sales_forecast";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."sales_forecast";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."sales_forecast";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."sales_forecast";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."sales_forecast";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."sales_forecast";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."sales_forecast";

CREATE POLICY "sales_forecast_tenant_policy" ON public."sales_forecast" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: sales_goals ---
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."sales_goals";
DROP POLICY IF EXISTS "sales_goals_company_isolation" ON public."sales_goals";
DROP POLICY IF EXISTS "company_access" ON public."sales_goals";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."sales_goals";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."sales_goals";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."sales_goals";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."sales_goals";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."sales_goals";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."sales_goals";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."sales_goals";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."sales_goals";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."sales_goals";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."sales_goals";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."sales_goals";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."sales_goals";
DROP POLICY IF EXISTS "cp_self_update" ON public."sales_goals";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."sales_goals";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."sales_goals";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."sales_goals";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."sales_goals";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."sales_goals";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."sales_goals";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."sales_goals";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."sales_goals";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."sales_goals";

CREATE POLICY "sales_goals_tenant_policy" ON public."sales_goals" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: loss_reasons ---
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."loss_reasons";
DROP POLICY IF EXISTS "loss_reasons_company_isolation" ON public."loss_reasons";
DROP POLICY IF EXISTS "company_access" ON public."loss_reasons";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."loss_reasons";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."loss_reasons";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."loss_reasons";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."loss_reasons";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."loss_reasons";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."loss_reasons";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."loss_reasons";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."loss_reasons";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."loss_reasons";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."loss_reasons";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."loss_reasons";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."loss_reasons";
DROP POLICY IF EXISTS "cp_self_update" ON public."loss_reasons";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."loss_reasons";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."loss_reasons";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."loss_reasons";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."loss_reasons";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."loss_reasons";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."loss_reasons";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."loss_reasons";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."loss_reasons";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."loss_reasons";

CREATE POLICY "loss_reasons_tenant_policy" ON public."loss_reasons" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: contractor_profiles ---
DROP POLICY IF EXISTS "contractor_profiles_tenant_policy" ON public."contractor_profiles";
DROP POLICY IF EXISTS "contractor_profiles_company_isolation" ON public."contractor_profiles";
DROP POLICY IF EXISTS "company_access" ON public."contractor_profiles";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."contractor_profiles";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."contractor_profiles";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."contractor_profiles";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."contractor_profiles";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."contractor_profiles";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."contractor_profiles";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."contractor_profiles";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."contractor_profiles";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."contractor_profiles";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."contractor_profiles";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."contractor_profiles";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."contractor_profiles";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."contractor_profiles";
DROP POLICY IF EXISTS "cp_self_update" ON public."contractor_profiles";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."contractor_profiles";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."contractor_profiles";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."contractor_profiles";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."contractor_profiles";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."contractor_profiles";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."contractor_profiles";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."contractor_profiles";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."contractor_profiles";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."contractor_profiles";

CREATE POLICY "contractor_profiles_tenant_policy" ON public."contractor_profiles" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: pagos ---
DROP POLICY IF EXISTS "pagos_tenant_policy" ON public."pagos";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."pagos";
DROP POLICY IF EXISTS "company_access" ON public."pagos";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."pagos";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."pagos";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."pagos";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."pagos";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."pagos";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."pagos";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."pagos";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."pagos";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."pagos";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."pagos";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."pagos";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."pagos";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."pagos";
DROP POLICY IF EXISTS "cp_self_update" ON public."pagos";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."pagos";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."pagos";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."pagos";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."pagos";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."pagos";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."pagos";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."pagos";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."pagos";

CREATE POLICY "pagos_tenant_policy" ON public."pagos" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: gastos ---
DROP POLICY IF EXISTS "gastos_tenant_policy" ON public."gastos";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."gastos";
DROP POLICY IF EXISTS "company_access" ON public."gastos";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."gastos";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."gastos";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."gastos";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."gastos";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."gastos";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."gastos";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."gastos";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."gastos";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."gastos";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."gastos";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."gastos";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."gastos";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."gastos";
DROP POLICY IF EXISTS "cp_self_update" ON public."gastos";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."gastos";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."gastos";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."gastos";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."gastos";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."gastos";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."gastos";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."gastos";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."gastos";

CREATE POLICY "gastos_tenant_policy" ON public."gastos" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: planes_pago ---
DROP POLICY IF EXISTS "planes_pago_tenant_policy" ON public."planes_pago";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."planes_pago";
DROP POLICY IF EXISTS "company_access" ON public."planes_pago";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."planes_pago";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."planes_pago";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."planes_pago";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."planes_pago";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."planes_pago";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."planes_pago";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."planes_pago";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."planes_pago";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."planes_pago";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."planes_pago";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."planes_pago";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."planes_pago";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."planes_pago";
DROP POLICY IF EXISTS "cp_self_update" ON public."planes_pago";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."planes_pago";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."planes_pago";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."planes_pago";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."planes_pago";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."planes_pago";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."planes_pago";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."planes_pago";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."planes_pago";

CREATE POLICY "planes_pago_tenant_policy" ON public."planes_pago" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: cuotas_esperadas ---
DROP POLICY IF EXISTS "cuotas_esperadas_tenant_policy" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "company_access" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "cp_self_update" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."cuotas_esperadas";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."cuotas_esperadas";

CREATE POLICY "cuotas_esperadas_tenant_policy" ON public."cuotas_esperadas" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: catalog_item_types ---
DROP POLICY IF EXISTS "catalog_item_types_tenant_policy" ON public."catalog_item_types";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."catalog_item_types";
DROP POLICY IF EXISTS "company_access" ON public."catalog_item_types";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."catalog_item_types";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."catalog_item_types";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."catalog_item_types";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."catalog_item_types";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."catalog_item_types";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."catalog_item_types";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."catalog_item_types";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."catalog_item_types";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."catalog_item_types";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."catalog_item_types";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."catalog_item_types";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."catalog_item_types";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."catalog_item_types";
DROP POLICY IF EXISTS "cp_self_update" ON public."catalog_item_types";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."catalog_item_types";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."catalog_item_types";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."catalog_item_types";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."catalog_item_types";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."catalog_item_types";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."catalog_item_types";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."catalog_item_types";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."catalog_item_types";

CREATE POLICY "catalog_item_types_tenant_policy" ON public."catalog_item_types" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: pricing_items ---
DROP POLICY IF EXISTS "pricing_items_tenant_policy" ON public."pricing_items";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."pricing_items";
DROP POLICY IF EXISTS "company_access" ON public."pricing_items";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."pricing_items";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."pricing_items";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."pricing_items";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."pricing_items";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."pricing_items";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."pricing_items";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."pricing_items";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."pricing_items";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."pricing_items";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."pricing_items";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."pricing_items";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."pricing_items";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."pricing_items";
DROP POLICY IF EXISTS "cp_self_update" ON public."pricing_items";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."pricing_items";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."pricing_items";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."pricing_items";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."pricing_items";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."pricing_items";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."pricing_items";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."pricing_items";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."pricing_items";

CREATE POLICY "pricing_items_tenant_policy" ON public."pricing_items" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: company_subscriptions ---
DROP POLICY IF EXISTS "company_subscriptions_tenant_policy" ON public."company_subscriptions";
DROP POLICY IF EXISTS "company_subscriptions_company_isolation" ON public."company_subscriptions";
DROP POLICY IF EXISTS "company_access" ON public."company_subscriptions";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."company_subscriptions";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."company_subscriptions";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."company_subscriptions";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."company_subscriptions";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."company_subscriptions";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."company_subscriptions";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."company_subscriptions";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."company_subscriptions";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."company_subscriptions";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."company_subscriptions";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."company_subscriptions";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."company_subscriptions";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."company_subscriptions";
DROP POLICY IF EXISTS "cp_self_update" ON public."company_subscriptions";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."company_subscriptions";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."company_subscriptions";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."company_subscriptions";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."company_subscriptions";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."company_subscriptions";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."company_subscriptions";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."company_subscriptions";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."company_subscriptions";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."company_subscriptions";

CREATE POLICY "company_subscriptions_tenant_policy" ON public."company_subscriptions" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: usage_events ---
DROP POLICY IF EXISTS "usage_events_tenant_policy" ON public."usage_events";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."usage_events";
DROP POLICY IF EXISTS "company_access" ON public."usage_events";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."usage_events";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."usage_events";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."usage_events";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."usage_events";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."usage_events";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."usage_events";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."usage_events";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."usage_events";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."usage_events";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."usage_events";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."usage_events";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."usage_events";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."usage_events";
DROP POLICY IF EXISTS "cp_self_update" ON public."usage_events";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."usage_events";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."usage_events";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."usage_events";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."usage_events";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."usage_events";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."usage_events";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."usage_events";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."usage_events";

CREATE POLICY "usage_events_tenant_policy" ON public."usage_events" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: company_webhooks ---
DROP POLICY IF EXISTS "company_webhooks_tenant_policy" ON public."company_webhooks";
DROP POLICY IF EXISTS "company_webhooks_company_isolation" ON public."company_webhooks";
DROP POLICY IF EXISTS "company_access" ON public."company_webhooks";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."company_webhooks";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."company_webhooks";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."company_webhooks";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."company_webhooks";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."company_webhooks";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."company_webhooks";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."company_webhooks";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."company_webhooks";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."company_webhooks";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."company_webhooks";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."company_webhooks";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."company_webhooks";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."company_webhooks";
DROP POLICY IF EXISTS "cp_self_update" ON public."company_webhooks";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."company_webhooks";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."company_webhooks";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."company_webhooks";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."company_webhooks";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."company_webhooks";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."company_webhooks";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."company_webhooks";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."company_webhooks";

CREATE POLICY "company_webhooks_tenant_policy" ON public."company_webhooks" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: webhook_delivery_logs ---
DROP POLICY IF EXISTS "webhook_delivery_logs_tenant_policy" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "webhook_delivery_logs_company_isolation" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "company_access" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "cp_self_update" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."webhook_delivery_logs";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."webhook_delivery_logs";

CREATE POLICY "webhook_delivery_logs_tenant_policy" ON public."webhook_delivery_logs" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: saas_invoices ---
DROP POLICY IF EXISTS "saas_invoices_tenant_policy" ON public."saas_invoices";
DROP POLICY IF EXISTS "saas_invoices_company_isolation" ON public."saas_invoices";
DROP POLICY IF EXISTS "company_access" ON public."saas_invoices";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."saas_invoices";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."saas_invoices";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."saas_invoices";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."saas_invoices";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."saas_invoices";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."saas_invoices";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."saas_invoices";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."saas_invoices";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."saas_invoices";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."saas_invoices";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."saas_invoices";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."saas_invoices";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."saas_invoices";
DROP POLICY IF EXISTS "cp_self_update" ON public."saas_invoices";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."saas_invoices";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."saas_invoices";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."saas_invoices";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."saas_invoices";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."saas_invoices";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."saas_invoices";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."saas_invoices";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."saas_invoices";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."saas_invoices";

CREATE POLICY "saas_invoices_tenant_policy" ON public."saas_invoices" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: api_keys ---
DROP POLICY IF EXISTS "api_keys_tenant_policy" ON public."api_keys";
DROP POLICY IF EXISTS "api_keys_company_isolation" ON public."api_keys";
DROP POLICY IF EXISTS "company_access" ON public."api_keys";
DROP POLICY IF EXISTS "subscriptions_company_read" ON public."api_keys";
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public."api_keys";
DROP POLICY IF EXISTS "webhook_logs_company_read" ON public."api_keys";
DROP POLICY IF EXISTS "custom_roles_tenant_policy" ON public."api_keys";
DROP POLICY IF EXISTS "financing_plans_tenant_policy" ON public."api_keys";
DROP POLICY IF EXISTS "company_invitations_tenant_policy" ON public."api_keys";
DROP POLICY IF EXISTS "marketing_lead_searches_tenant_policy" ON public."api_keys";
DROP POLICY IF EXISTS "marketing_templates_tenant_policy" ON public."api_keys";
DROP POLICY IF EXISTS "payment_settings_tenant_policy" ON public."api_keys";
DROP POLICY IF EXISTS "performance_goals_tenant_policy" ON public."api_keys";
DROP POLICY IF EXISTS "sales_forecast_tenant_policy" ON public."api_keys";
DROP POLICY IF EXISTS "sales_goals_tenant_policy" ON public."api_keys";
DROP POLICY IF EXISTS "loss_reasons_tenant_policy" ON public."api_keys";
DROP POLICY IF EXISTS "cp_self_update" ON public."api_keys";
DROP POLICY IF EXISTS "pagos_company_isolation" ON public."api_keys";
DROP POLICY IF EXISTS "gastos_company_isolation" ON public."api_keys";
DROP POLICY IF EXISTS "planes_pago_company_isolation" ON public."api_keys";
DROP POLICY IF EXISTS "cuotas_esperadas_company_isolation" ON public."api_keys";
DROP POLICY IF EXISTS "catalog_item_types_company_isolation" ON public."api_keys";
DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public."api_keys";
DROP POLICY IF EXISTS "usage_events_company_isolation" ON public."api_keys";
DROP POLICY IF EXISTS "company_webhooks_isolation" ON public."api_keys";

CREATE POLICY "api_keys_tenant_policy" ON public."api_keys" FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: company_calendars ---
DROP POLICY IF EXISTS company_calendars_select ON public.company_calendars;
CREATE POLICY company_calendars_select ON public.company_calendars FOR SELECT TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

DROP POLICY IF EXISTS company_calendars_admin ON public.company_calendars;
CREATE POLICY company_calendars_admin ON public.company_calendars FOR ALL TO authenticated
  USING (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) IN ('company_admin', 'super_admin')
  )
  WITH CHECK (
    (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    AND (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) IN ('company_admin', 'super_admin')
  );

-- --- Table: calendar_access ---
DROP POLICY IF EXISTS calendar_access_user_select ON public.calendar_access;
CREATE POLICY calendar_access_user_select ON public.calendar_access FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid()
      AND role IN ('company_admin', 'super_admin')
      AND (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    )
  );

DROP POLICY IF EXISTS calendar_access_admin ON public.calendar_access;
CREATE POLICY calendar_access_admin ON public.calendar_access FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_calendars cc
      WHERE cc.id = calendar_access.company_calendar_id
      AND (cc.company_id = public.get_auth_company_id() OR cc.company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
      AND (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) IN ('company_admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_calendars cc
      WHERE cc.id = calendar_access.company_calendar_id
      AND (cc.company_id = public.get_auth_company_id() OR cc.company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
      AND (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) IN ('company_admin', 'super_admin')
    )
  );

-- --- Table: call_queue ---
DROP POLICY IF EXISTS call_queue_select ON public.call_queue;
CREATE POLICY call_queue_select ON public.call_queue FOR SELECT TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

DROP POLICY IF EXISTS call_queue_insert ON public.call_queue;
CREATE POLICY call_queue_insert ON public.call_queue FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

DROP POLICY IF EXISTS call_queue_update ON public.call_queue;
CREATE POLICY call_queue_update ON public.call_queue FOR UPDATE TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

DROP POLICY IF EXISTS call_queue_delete ON public.call_queue;
CREATE POLICY call_queue_delete ON public.call_queue FOR DELETE TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );

-- --- Table: crm_task_time_logs ---
DROP POLICY IF EXISTS crm_task_time_logs_all_policy ON public.crm_task_time_logs;
CREATE POLICY crm_task_time_logs_all_policy ON public.crm_task_time_logs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_tasks t
      JOIN public.crm_projects p ON p.id = t.project_id
      WHERE t.id = crm_task_time_logs.task_id
      AND (p.company_id = public.get_auth_company_id() OR p.company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_tasks t
      JOIN public.crm_projects p ON p.id = t.project_id
      WHERE t.id = crm_task_time_logs.task_id
      AND (p.company_id = public.get_auth_company_id() OR p.company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    )
  );

-- --- Table: role_permissions ---
DROP POLICY IF EXISTS role_permissions_tenant_policy ON public.role_permissions;
CREATE POLICY role_permissions_tenant_policy ON public.role_permissions FOR ALL TO authenticated
  USING (
    role_id IN (
      SELECT cr.id FROM public.custom_roles cr
      WHERE cr.company_id = public.get_auth_company_id()
      OR cr.company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
    )
  )
  WITH CHECK (
    role_id IN (
      SELECT cr.id FROM public.custom_roles cr
      WHERE cr.company_id = public.get_auth_company_id()
      OR cr.company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
    )
  );

-- --- Table: team_members ---
DROP POLICY IF EXISTS team_members_tenant_policy ON public.team_members;
CREATE POLICY team_members_tenant_policy ON public.team_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
      AND (t.company_id = public.get_auth_company_id() OR t.company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
      AND (t.company_id = public.get_auth_company_id() OR t.company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
    )
  );

-- --- Table: calendar_integrations ---
DROP POLICY IF EXISTS calendar_integrations_user_own ON public.calendar_integrations;
CREATE POLICY calendar_integrations_user_own ON public.calendar_integrations FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
  );

DROP POLICY IF EXISTS calendar_integrations_admin_read ON public.calendar_integrations;
CREATE POLICY calendar_integrations_admin_read ON public.calendar_integrations FOR SELECT TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
  );
