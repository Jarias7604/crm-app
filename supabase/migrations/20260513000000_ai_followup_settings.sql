-- ============================================================
-- AI Followup Settings — Dynamic per-company configuration
-- Fase 1: Safe defaults match current hardcoded behavior
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_followup_settings (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

    -- ── Timing ────────────────────────────────────────────────
    first_followup_hours    int  NOT NULL DEFAULT 24,   -- Hours after last inbound before 1st followup
    second_followup_hours   int  NOT NULL DEFAULT 72,   -- Hours after 1st followup before 2nd
    third_followup_hours    int  NOT NULL DEFAULT 168,  -- Hours after 2nd before final attempt

    -- ── Limits ────────────────────────────────────────────────
    max_followups           int  NOT NULL DEFAULT 3,    -- Max attempts before escalating to human (1-5)
    auto_escalate           bool NOT NULL DEFAULT true, -- Create escalation alert after max_followups

    -- ── Schedule Guards ───────────────────────────────────────
    only_business_hours     bool NOT NULL DEFAULT false, -- Only send Mon-Fri 8am-6pm (company timezone)
    timezone                text NOT NULL DEFAULT 'America/El_Salvador',
    pause_after_quote       bool NOT NULL DEFAULT false, -- Pause followup if a quote was already sent

    -- ── Message Templates (use {nombre}, {empresa}, {plan}) ──
    followup_1_template     text DEFAULT NULL, -- NULL = use built-in smart message
    followup_2_template     text DEFAULT NULL,
    followup_3_template     text DEFAULT NULL,

    -- ── Global Toggle ─────────────────────────────────────────
    is_active               bool NOT NULL DEFAULT true,

    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now(),

    CONSTRAINT uq_followup_settings_company UNIQUE (company_id),
    CONSTRAINT chk_max_followups CHECK (max_followups BETWEEN 1 AND 5),
    CONSTRAINT chk_first_hours   CHECK (first_followup_hours  BETWEEN 1 AND 336),
    CONSTRAINT chk_second_hours  CHECK (second_followup_hours BETWEEN 1 AND 336),
    CONSTRAINT chk_third_hours   CHECK (third_followup_hours  BETWEEN 1 AND 720)
);

-- RLS
ALTER TABLE public.ai_followup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage their followup settings"
ON public.ai_followup_settings
FOR ALL
USING (
    company_id IN (
        SELECT company_id FROM public.profiles
        WHERE id = auth.uid()
    )
);

-- Auto-update timestamp
CREATE OR REPLACE TRIGGER trg_ai_followup_settings_updated_at
BEFORE UPDATE ON public.ai_followup_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default settings for Arias Defense (existing tenant)
INSERT INTO public.ai_followup_settings (company_id)
VALUES ('7a582ba5-f7d0-4ae3-9985-35788deb1c30')
ON CONFLICT (company_id) DO NOTHING;

-- Cron job: run auto-followup every 4 hours
-- Requires pg_cron extension (already available on Supabase Pro)
SELECT cron.schedule(
    'ai-auto-followup',
    '0 */4 * * *',
    $$
    SELECT
        net.http_post(
            url     := (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/auto-followup',
            headers := jsonb_build_object(
                'Content-Type',  'application/json',
                'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
            ),
            body    := '{}'::jsonb
        );
    $$
);

COMMENT ON TABLE public.ai_followup_settings IS
'Per-company dynamic configuration for the auto-followup AI engine. '
'All timing fields are in hours. NULL templates use the built-in smart message builder.';
