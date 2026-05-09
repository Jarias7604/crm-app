-- Performance indexes - safe, idempotent, production-ready
-- Each index uses IF NOT EXISTS to avoid errors if run multiple times

CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_created ON public.leads(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_user ON public.leads(assigned_to) WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_company_id ON public.cotizaciones(company_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_lead_id ON public.cotizaciones(lead_id);

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_role ON public.profiles(company_id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_custom_role_id ON public.profiles(custom_role_id) WHERE custom_role_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_key ON public.role_permissions(role_id, permission_key);
CREATE INDEX IF NOT EXISTS idx_role_permissions_enabled ON public.role_permissions(role_id, is_enabled) WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_custom_roles_company_id ON public.custom_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_custom_roles_company_base ON public.custom_roles(company_id, base_role);

CREATE INDEX IF NOT EXISTS idx_clients_company_id ON public.clients(company_id);

CREATE INDEX IF NOT EXISTS idx_marketing_conversations_company ON public.marketing_conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_messages_conversation ON public.marketing_messages(conversation_id);
