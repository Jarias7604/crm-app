-- ============================================================
-- SOFÍA AI CALL BOT — call_queue table
-- Created: 2026-05-23
-- Project: Arias Defense CRM (ikofyypxphrqkncimszt)
-- ============================================================

-- ── ENUMS ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE call_status  AS ENUM ('pending','calling','completed','no_answer','retry','cancelled','failed');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE call_trigger AS ENUM ('new_lead_auto','stage_change','manual','cron_auto');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE call_outcome AS ENUM ('connected_qualified','connected_not_qualified','no_answer','voicemail','error');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── TABLE ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_queue (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lead_id             UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

    -- Status & control
    status              call_status  NOT NULL DEFAULT 'pending',
    trigger_type        call_trigger NOT NULL DEFAULT 'manual',
    mode                TEXT NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual','auto')),

    -- Scheduling
    scheduled_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at          TIMESTAMPTZ,
    ended_at            TIMESTAMPTZ,

    -- Telnyx call tracking
    call_id             TEXT,        -- Telnyx call_control_id
    attempt             INTEGER NOT NULL DEFAULT 1,

    -- Outcome
    outcome             call_outcome,
    ai_score            INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
    demo_booked         BOOLEAN NOT NULL DEFAULT FALSE,
    duration_seconds    INTEGER,
    error_message       TEXT,

    -- Content
    transcript          JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary             TEXT,
    recording_url       TEXT,

    -- Metadata
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_call_queue_company_id   ON public.call_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_lead_id      ON public.call_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_status       ON public.call_queue(status);
CREATE INDEX IF NOT EXISTS idx_call_queue_scheduled_at ON public.call_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_call_queue_company_status ON public.call_queue(company_id, status);

-- ── AUTO-UPDATE updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_call_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_call_queue_updated_at ON public.call_queue;
CREATE TRIGGER trg_call_queue_updated_at
    BEFORE UPDATE ON public.call_queue
    FOR EACH ROW EXECUTE FUNCTION public.update_call_queue_updated_at();

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
ALTER TABLE public.call_queue ENABLE ROW LEVEL SECURITY;

-- Company admins and agents can see their own company's call queue
CREATE POLICY "call_queue_select" ON public.call_queue
    FOR SELECT USING (
        company_id = public.get_auth_company_id()
    );

-- Only company admins can insert/update/delete
CREATE POLICY "call_queue_insert" ON public.call_queue
    FOR INSERT WITH CHECK (
        company_id = public.get_auth_company_id()
    );

CREATE POLICY "call_queue_update" ON public.call_queue
    FOR UPDATE USING (
        company_id = public.get_auth_company_id()
    );

CREATE POLICY "call_queue_delete" ON public.call_queue
    FOR DELETE USING (
        company_id = public.get_auth_company_id()
    );

-- ── CRON: Sofia Call Dispatcher (every 5 minutes) ────────────────────────────
-- This cron checks for pending leads to call in AUTO mode
-- Only runs if: within call hours, auto mode enabled, leads haven't been called today

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove if exists to avoid duplicates
SELECT cron.unschedule('sofia-call-dispatcher') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sofia-call-dispatcher'
);

SELECT cron.schedule(
    'sofia-call-dispatcher',
    '*/5 * * * *',
    $$
        SELECT net.http_post(
            url:='https://ikofyypxphrqkncimszt.supabase.co/functions/v1/sofia-voice-bot',
            headers:='{"Content-Type": "application/json"}'::jsonb,
            body:='{"action": "auto_dispatch"}'::jsonb
        ) as request_id;
    $$
);

-- ── COMMENT ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.call_queue IS 'Sofía AI Call Bot — queue of calls initiated by the system or manually by admins. Tracks full call lifecycle: pending → calling → completed/no_answer. Transcript and AI score stored per call.';
