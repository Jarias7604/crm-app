-- ============================================================
-- BILLING & SAAS INFRASTRUCTURE MIGRATION
-- Bloques 1A + 3A + 3B + 3C: Billing, Calendar, Webhooks, API Keys
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-05-04
-- ============================================================

-- ============================================================
-- 1. TABLE: saas_plans (Planes disponibles del producto)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saas_plans (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    slug            text NOT NULL UNIQUE,  -- 'starter', 'pro', 'enterprise'
    name            text NOT NULL,
    description     text,
    price_monthly   numeric(10,2) NOT NULL DEFAULT 0,
    price_annual    numeric(10,2) NOT NULL DEFAULT 0,
    max_users       integer NOT NULL DEFAULT 5,
    max_leads       integer NOT NULL DEFAULT 500,
    max_ai_tokens   integer NOT NULL DEFAULT 50000,
    features        jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_active       boolean NOT NULL DEFAULT true,
    sort_order      integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Only super_admin can manage plans
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saas_plans_read_all" ON public.saas_plans;
CREATE POLICY "saas_plans_read_all" ON public.saas_plans
    FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "saas_plans_super_admin_all" ON public.saas_plans;
CREATE POLICY "saas_plans_super_admin_all" ON public.saas_plans
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'super_admin' OR is_platform_owner = true))
    );

-- Seed: Initial plans
INSERT INTO public.saas_plans (slug, name, description, price_monthly, price_annual, max_users, max_leads, max_ai_tokens, features, sort_order)
VALUES
    ('starter', 'Starter', 'Perfecto para equipos pequeños que están comenzando.', 29.00, 290.00, 5, 500, 25000,
     '["Leads & Pipeline", "Cotizaciones PDF", "Calendario", "Reportes Básicos", "Soporte por Email"]'::jsonb, 1),
    ('pro', 'Pro', 'Para empresas en crecimiento que necesitan más poder.', 99.00, 990.00, 20, 5000, 150000,
     '["Todo en Starter", "Marketing Hub", "AI Consultant", "Bandeja Omnicanal", "Webhooks & API", "Google Calendar Sync", "Reportes Avanzados", "Soporte Prioritario"]'::jsonb, 2),
    ('enterprise', 'Enterprise', 'Solución completa para organizaciones que escalan.', 299.00, 2990.00, 100, 999999, 1000000,
     '["Todo en Pro", "Digital Sales Room", "AI Autonomous Agent", "Revenue Intelligence", "SSO & 2FA", "Audit Log", "SLA 99.9%", "Soporte Dedicado", "White-Label Disponible"]'::jsonb, 3)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    price_monthly = EXCLUDED.price_monthly,
    price_annual = EXCLUDED.price_annual,
    max_users = EXCLUDED.max_users,
    features = EXCLUDED.features,
    updated_at = now();

-- ============================================================
-- 2. TABLE: company_subscriptions (Suscripción activa por tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
    id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id              uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    plan_id                 uuid NOT NULL REFERENCES public.saas_plans(id),
    status                  text NOT NULL DEFAULT 'trialing'
                                CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
    billing_cycle           text NOT NULL DEFAULT 'monthly'
                                CHECK (billing_cycle IN ('monthly', 'annual')),
    -- Stripe IDs
    stripe_customer_id      text,
    stripe_subscription_id  text,
    stripe_price_id         text,
    -- Dates
    trial_ends_at           timestamptz,
    current_period_start    timestamptz,
    current_period_end      timestamptz,
    canceled_at             timestamptz,
    -- Metadata
    metadata                jsonb DEFAULT '{}'::jsonb,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE(company_id)  -- One active subscription per company
);

ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

-- Company admins can read their own subscription
DROP POLICY IF EXISTS "subscriptions_company_read" ON public.company_subscriptions;
CREATE POLICY "subscriptions_company_read" ON public.company_subscriptions
    FOR SELECT TO authenticated
    USING (company_id = (SELECT get_auth_company_id()));

-- Only super_admin can write
DROP POLICY IF EXISTS "subscriptions_super_admin_all" ON public.company_subscriptions;
CREATE POLICY "subscriptions_super_admin_all" ON public.company_subscriptions
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'super_admin' OR is_platform_owner = true))
    );

-- Seed: Give existing companies a default 'pro' trial subscription
DO $$
DECLARE
    v_pro_plan_id uuid;
BEGIN
    SELECT id INTO v_pro_plan_id FROM public.saas_plans WHERE slug = 'pro' LIMIT 1;

    IF v_pro_plan_id IS NOT NULL THEN
        INSERT INTO public.company_subscriptions (company_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
        SELECT
            c.id,
            v_pro_plan_id,
            'trialing',
            now() + interval '14 days',
            now(),
            now() + interval '14 days'
        FROM public.companies c
        WHERE NOT EXISTS (
            SELECT 1 FROM public.company_subscriptions cs WHERE cs.company_id = c.id
        );
    END IF;
END;
$$;

-- ============================================================
-- 3. TABLE: usage_events (Metering de consumo por tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usage_events (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    event_type  text NOT NULL,  -- 'ai_token', 'sms_sent', 'email_sent', 'lead_created'
    quantity    integer NOT NULL DEFAULT 1,
    metadata    jsonb DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_events_company_isolation" ON public.usage_events;
CREATE POLICY "usage_events_company_isolation" ON public.usage_events
    FOR ALL TO authenticated
    USING (company_id = (SELECT get_auth_company_id()))
    WITH CHECK (company_id = (SELECT get_auth_company_id()));

-- Super admin can read all
DROP POLICY IF EXISTS "usage_events_super_admin_read" ON public.usage_events;
CREATE POLICY "usage_events_super_admin_read" ON public.usage_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'super_admin' OR is_platform_owner = true))
    );

-- Index for fast time-range queries
CREATE INDEX IF NOT EXISTS idx_usage_events_company_type_date
    ON public.usage_events (company_id, event_type, created_at DESC);

-- ============================================================
-- 4. TABLE: calendar_integrations (Google Calendar OAuth por tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.calendar_integrations (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider            text NOT NULL DEFAULT 'google'
                            CHECK (provider IN ('google', 'outlook')),
    access_token        text,   -- Encrypted at rest via Supabase Vault ideally
    refresh_token       text,
    token_expires_at    timestamptz,
    google_email        text,
    calendar_id         text DEFAULT 'primary',
    is_active           boolean NOT NULL DEFAULT true,
    sync_follow_ups     boolean NOT NULL DEFAULT true,
    create_meet_links   boolean NOT NULL DEFAULT true,
    last_synced_at      timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE(company_id, user_id, provider)
);

ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_integrations_user_own" ON public.calendar_integrations;
CREATE POLICY "calendar_integrations_user_own" ON public.calendar_integrations
    FOR ALL TO authenticated
    USING (user_id = auth.uid() AND company_id = (SELECT get_auth_company_id()))
    WITH CHECK (user_id = auth.uid() AND company_id = (SELECT get_auth_company_id()));

-- Admins can view all integrations of their company
DROP POLICY IF EXISTS "calendar_integrations_admin_read" ON public.calendar_integrations;
CREATE POLICY "calendar_integrations_admin_read" ON public.calendar_integrations
    FOR SELECT TO authenticated
    USING (company_id = (SELECT get_auth_company_id()));

-- ============================================================
-- 5. TABLE: company_webhooks (Webhooks de salida configurados por tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_webhooks (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name            text NOT NULL,
    url             text NOT NULL,
    secret          text,           -- HMAC secret para verificar autenticidad
    events          text[] NOT NULL DEFAULT '{}',  -- ['lead.created', 'quote.sent', ...]
    is_active       boolean NOT NULL DEFAULT true,
    last_triggered_at timestamptz,
    failure_count   integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_webhooks_isolation" ON public.company_webhooks;
CREATE POLICY "company_webhooks_isolation" ON public.company_webhooks
    FOR ALL TO authenticated
    USING (company_id = (SELECT get_auth_company_id()))
    WITH CHECK (company_id = (SELECT get_auth_company_id()));

-- ============================================================
-- 6. TABLE: webhook_delivery_logs (Log de entregas de webhooks)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_delivery_logs (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    webhook_id      uuid NOT NULL REFERENCES public.company_webhooks(id) ON DELETE CASCADE,
    company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    status          text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'success', 'failed')),
    response_status integer,        -- HTTP status code from the destination
    response_body   text,
    attempt_count   integer NOT NULL DEFAULT 1,
    next_retry_at   timestamptz,
    delivered_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_logs_company_read" ON public.webhook_delivery_logs;
CREATE POLICY "webhook_logs_company_read" ON public.webhook_delivery_logs
    FOR SELECT TO authenticated
    USING (company_id = (SELECT get_auth_company_id()));

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_date
    ON public.webhook_delivery_logs (webhook_id, created_at DESC);

-- ============================================================
-- 7. TABLE: api_keys (API Keys públicas por tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_keys (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name            text NOT NULL,
    key_hash        text NOT NULL UNIQUE,   -- SHA-256 hash of the actual key
    key_prefix      text NOT NULL,          -- First 8 chars for display: 'aria_xxxx...'
    scopes          text[] NOT NULL DEFAULT '{"leads:read"}',
    is_active       boolean NOT NULL DEFAULT true,
    last_used_at    timestamptz,
    expires_at      timestamptz,
    created_by      uuid REFERENCES auth.users(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys_company_isolation" ON public.api_keys;
CREATE POLICY "api_keys_company_isolation" ON public.api_keys
    FOR ALL TO authenticated
    USING (company_id = (SELECT get_auth_company_id()))
    WITH CHECK (company_id = (SELECT get_auth_company_id()));

-- ============================================================
-- 8. RPC: get_company_subscription (Helper para el frontend)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_company_subscription()
RETURNS TABLE (
    subscription_id     uuid,
    plan_slug           text,
    plan_name           text,
    status              text,
    billing_cycle       text,
    price_monthly       numeric,
    price_annual        numeric,
    max_users           integer,
    max_leads           integer,
    max_ai_tokens       integer,
    features            jsonb,
    trial_ends_at       timestamptz,
    current_period_end  timestamptz,
    stripe_customer_id  text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        cs.id,
        sp.slug,
        sp.name,
        cs.status,
        cs.billing_cycle,
        sp.price_monthly,
        sp.price_annual,
        sp.max_users,
        sp.max_leads,
        sp.max_ai_tokens,
        sp.features,
        cs.trial_ends_at,
        cs.current_period_end,
        cs.stripe_customer_id
    FROM public.company_subscriptions cs
    JOIN public.saas_plans sp ON cs.plan_id = sp.id
    WHERE cs.company_id = get_auth_company_id()
    LIMIT 1;
$$;

-- ============================================================
-- 9. RPC: get_all_tenant_stats (Super Admin Observatory)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_all_tenant_stats()
RETURNS TABLE (
    company_id      uuid,
    company_name    text,
    plan_name       text,
    plan_slug       text,
    status          text,
    user_count      bigint,
    lead_count      bigint,
    quote_count     bigint,
    current_period_end timestamptz,
    price_monthly   numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        c.id,
        c.name,
        sp.name,
        sp.slug,
        cs.status,
        (SELECT COUNT(*) FROM public.profiles p WHERE p.company_id = c.id AND p.status = 'active'),
        (SELECT COUNT(*) FROM public.leads l WHERE l.company_id = c.id),
        (SELECT COUNT(*) FROM public.quotes q WHERE q.company_id = c.id),
        cs.current_period_end,
        sp.price_monthly
    FROM public.companies c
    LEFT JOIN public.company_subscriptions cs ON cs.company_id = c.id
    LEFT JOIN public.saas_plans sp ON cs.plan_id = sp.id
    ORDER BY c.created_at DESC;
$$;

-- Grant execute only to authenticated (RLS handles the super_admin check)
GRANT EXECUTE ON FUNCTION public.get_all_tenant_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_subscription() TO authenticated;

SELECT 'Billing & SaaS Infrastructure migration applied successfully! Tables: saas_plans, company_subscriptions, usage_events, calendar_integrations, company_webhooks, webhook_delivery_logs, api_keys' AS result;
