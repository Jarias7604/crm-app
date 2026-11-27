-- =============================================================================
-- AI Usage Cost Tracking (ai_usage_logs) & Smart Advisor Calendar Rules
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    feature            text NOT NULL,
    provider           text NOT NULL DEFAULT 'openai',
    model              text NOT NULL,
    prompt_tokens      integer NOT NULL DEFAULT 0,
    completion_tokens  integer NOT NULL DEFAULT 0,
    total_tokens       integer NOT NULL DEFAULT 0,
    audio_seconds      numeric(10,2) NOT NULL DEFAULT 0,
    estimated_cost_usd numeric(12,6) NOT NULL DEFAULT 0,
    lead_id            uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    ticket_id          uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
    metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_company_created
    ON public.ai_usage_logs(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_company_feature
    ON public.ai_usage_logs(company_id, feature, created_at DESC);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_logs_select ON public.ai_usage_logs;
CREATE POLICY ai_usage_logs_select
    ON public.ai_usage_logs
    FOR SELECT TO authenticated
    USING (
        company_id = public.get_auth_company_id()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    );

ALTER TABLE public.lead_qualifier_configs
    ADD COLUMN IF NOT EXISTS sync_google_calendar_busy boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS ignore_unaccepted_calendar_invites boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS ai_monthly_budget_usd numeric(10,2) NOT NULL DEFAULT 20.00;
