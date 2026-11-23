-- =============================================================================
-- SaaS Multi-Tenant AI Lead Qualifier, Pain Playbooks, Auto-Demo Routing,
-- WhatsApp Advisor Alerts & SLA Escalation
-- =============================================================================

-- Allow direct WhatsApp outbox sends without creating fake support tickets
-- (used for internal advisor hot-lead / demo alerts & reminders)
ALTER TABLE public.whatsapp_outbox
    ALTER COLUMN ticket_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.lead_qualifier_configs (
    id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    is_enabled                   boolean NOT NULL DEFAULT false,
    mode                         text NOT NULL DEFAULT 'draft' CHECK (mode IN ('draft', 'auto')),
    response_24_7                boolean NOT NULL DEFAULT true,
    allowed_sources              text[] NOT NULL DEFAULT ARRAY['facebook_ads', 'google_sheets']::text[],
    max_ai_turns                 integer NOT NULL DEFAULT 6 CHECK (max_ai_turns BETWEEN 1 AND 20),
    timezone                     text NOT NULL DEFAULT 'America/El_Salvador',
    business_hours               jsonb NOT NULL DEFAULT '{"days":[1,2,3,4,5],"start":"08:00","end":"17:30","sat_enabled":true,"sat_start":"08:00","sat_end":"12:00"}'::jsonb,
    system_prompt                text NOT NULL DEFAULT '',
    first_touch_template         text NOT NULL DEFAULT '',
    handoff_reply_business_hours text NOT NULL DEFAULT '',
    handoff_reply_after_hours    text NOT NULL DEFAULT '',
    handoff_keywords             text[] NOT NULL DEFAULT ARRAY[
        'hablar con alguien',
        'persona real',
        'asesor humano',
        'asesor',
        'llamame',
        'llámeme',
        'llamada',
        'eres un bot',
        'quiero contratar',
        'ya quiero contratar',
        'mandeme contrato',
        'mándeme contrato',
        'hablar con un humano'
    ]::text[],
    pain_playbooks               jsonb NOT NULL DEFAULT '[]'::jsonb,
    demo_duration_minutes        integer NOT NULL DEFAULT 30 CHECK (demo_duration_minutes BETWEEN 15 AND 120),
    demo_buffer_minutes          integer NOT NULL DEFAULT 15 CHECK (demo_buffer_minutes BETWEEN 0 AND 60),
    notify_on_urgent_intake      boolean NOT NULL DEFAULT false,
    notify_on_handoff            boolean NOT NULL DEFAULT true,
    notify_on_demo_booked        boolean NOT NULL DEFAULT true,
    notify_advisors_24_7         boolean NOT NULL DEFAULT true,
    notify_channels              jsonb NOT NULL DEFAULT '{"whatsapp":true,"crm_alert":true,"email":false}'::jsonb,
    sla_escalation_minutes       integer NOT NULL DEFAULT 15 CHECK (sla_escalation_minutes BETWEEN 1 AND 240),
    sla_backup_user_id           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    crm_base_url                 text NOT NULL DEFAULT 'https://ariascrm.com',
    updated_by                   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at                   timestamptz NOT NULL DEFAULT now(),
    updated_at                   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_lead_qualifier_configs_company UNIQUE (company_id)
);

CREATE TABLE IF NOT EXISTS public.lead_demo_routing_rules (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name                  text NOT NULL,
    product_id            uuid REFERENCES public.lead_products(id) ON DELETE SET NULL,
    strategy              text NOT NULL DEFAULT 'round_robin' CHECK (strategy IN ('fixed', 'round_robin')),
    assignee_user_ids     uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
    last_assigned_index   integer NOT NULL DEFAULT -1,
    notify_extra_user_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
    priority              integer NOT NULL DEFAULT 10,
    is_active             boolean NOT NULL DEFAULT true,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_qualifier_sessions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lead_id             uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    ticket_id           uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
    status              text NOT NULL DEFAULT 'draft_pending'
                        CHECK (status IN (
                            'draft_pending',
                            'active',
                            'paused',
                            'handed_off',
                            'demo_booked',
                            'human_takeover',
                            'closed',
                            'max_turns'
                        )),
    mode                text NOT NULL DEFAULT 'draft' CHECK (mode IN ('draft', 'auto')),
    turn_count          integer NOT NULL DEFAULT 0,
    matched_playbook_id text,
    first_message_draft text,
    last_ai_draft       text,
    last_ai_action      text,
    offered_slots       jsonb NOT NULL DEFAULT '[]'::jsonb,
    booked_start_time   timestamptz,
    booked_end_time     timestamptz,
    booked_meet_link    text,
    booked_follow_up_id uuid,
    assigned_advisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    handoff_reason      text,
    handoff_summary     text,
    handoff_at          timestamptz,
    sla_deadline_at     timestamptz,
    sla_escalated_at    timestamptz,
    advisor_notified_at timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_lead_qualifier_sessions_lead UNIQUE (lead_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lead_qualifier_configs_company
    ON public.lead_qualifier_configs(company_id);

CREATE INDEX IF NOT EXISTS idx_lead_demo_routing_rules_company
    ON public.lead_demo_routing_rules(company_id, is_active, priority);

CREATE INDEX IF NOT EXISTS idx_lead_qualifier_sessions_company_status
    ON public.lead_qualifier_sessions(company_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_qualifier_sessions_ticket
    ON public.lead_qualifier_sessions(ticket_id);

CREATE INDEX IF NOT EXISTS idx_lead_qualifier_sessions_sla_pending
    ON public.lead_qualifier_sessions(company_id, sla_deadline_at)
    WHERE status = 'handed_off' AND sla_escalated_at IS NULL;

-- Generic SECURITY DEFINER timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_lead_qualifier_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_lead_qualifier_configs_updated_at ON public.lead_qualifier_configs;
CREATE TRIGGER tr_lead_qualifier_configs_updated_at
    BEFORE UPDATE ON public.lead_qualifier_configs
    FOR EACH ROW EXECUTE FUNCTION public.update_lead_qualifier_updated_at();

DROP TRIGGER IF EXISTS tr_lead_demo_routing_rules_updated_at ON public.lead_demo_routing_rules;
CREATE TRIGGER tr_lead_demo_routing_rules_updated_at
    BEFORE UPDATE ON public.lead_demo_routing_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_lead_qualifier_updated_at();

DROP TRIGGER IF EXISTS tr_lead_qualifier_sessions_updated_at ON public.lead_qualifier_sessions;
CREATE TRIGGER tr_lead_qualifier_sessions_updated_at
    BEFORE UPDATE ON public.lead_qualifier_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_lead_qualifier_updated_at();

-- Row Level Security
ALTER TABLE public.lead_qualifier_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_demo_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_qualifier_sessions ENABLE ROW LEVEL SECURITY;

-- Configs policies
DROP POLICY IF EXISTS lead_qualifier_configs_select ON public.lead_qualifier_configs;
CREATE POLICY lead_qualifier_configs_select
    ON public.lead_qualifier_configs
    FOR SELECT TO authenticated
    USING (
        company_id = public.get_auth_company_id()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    );

DROP POLICY IF EXISTS lead_qualifier_configs_manage ON public.lead_qualifier_configs;
CREATE POLICY lead_qualifier_configs_manage
    ON public.lead_qualifier_configs
    FOR ALL TO authenticated
    USING (
        (
            company_id = public.get_auth_company_id()
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                  AND profiles.role IN ('company_admin', 'super_admin')
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    )
    WITH CHECK (
        (
            company_id = public.get_auth_company_id()
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                  AND profiles.role IN ('company_admin', 'super_admin')
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    );

-- Routing rules policies
DROP POLICY IF EXISTS lead_demo_routing_rules_select ON public.lead_demo_routing_rules;
CREATE POLICY lead_demo_routing_rules_select
    ON public.lead_demo_routing_rules
    FOR SELECT TO authenticated
    USING (
        company_id = public.get_auth_company_id()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    );

DROP POLICY IF EXISTS lead_demo_routing_rules_manage ON public.lead_demo_routing_rules;
CREATE POLICY lead_demo_routing_rules_manage
    ON public.lead_demo_routing_rules
    FOR ALL TO authenticated
    USING (
        (
            company_id = public.get_auth_company_id()
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                  AND profiles.role IN ('company_admin', 'super_admin')
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    )
    WITH CHECK (
        (
            company_id = public.get_auth_company_id()
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                  AND profiles.role IN ('company_admin', 'super_admin')
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    );

-- Sessions policies (company team can view/pause/resume/approve drafts within their company)
DROP POLICY IF EXISTS lead_qualifier_sessions_company_all ON public.lead_qualifier_sessions;
CREATE POLICY lead_qualifier_sessions_company_all
    ON public.lead_qualifier_sessions
    FOR ALL TO authenticated
    USING (
        company_id = public.get_auth_company_id()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    )
    WITH CHECK (
        company_id = public.get_auth_company_id()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    );
