-- =============================================================================
-- ARIAS CRM — Social Planning & Multi-Tenant ChatGPT Bridge (v1.0)
-- Project: crm-app (mtxqqamitglhehaktgxm)
-- Non-destructive extension to social_posts + isolated ChatGPT tokens/OAuth
-- =============================================================================

-- 1. Extend social_posts (additive & backwards-compatible with SocialHub.tsx)
ALTER TABLE public.social_posts
    ADD COLUMN IF NOT EXISTS editorial_line TEXT,
    ADD COLUMN IF NOT EXISTS episode_label TEXT,
    ADD COLUMN IF NOT EXISTS topic TEXT,
    ADD COLUMN IF NOT EXISTS target_account_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'crm',
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_by_email TEXT,
    ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_due
    ON public.social_posts(status, scheduled_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_company_active
    ON public.social_posts(company_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- 2. Per-user & per-tenant ChatGPT connector tokens
CREATE TABLE IF NOT EXISTS public.social_bridge_tokens (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    label                TEXT NOT NULL DEFAULT 'ChatGPT Plus',
    token_prefix         TEXT NOT NULL,
    token_hash           TEXT NOT NULL UNIQUE,
    can_publish_directly BOOLEAN NOT NULL DEFAULT true,
    is_active            BOOLEAN NOT NULL DEFAULT true,
    last_used_at         TIMESTAMPTZ,
    expires_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_bridge_tokens_company
    ON public.social_bridge_tokens(company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_social_bridge_tokens_hash
    ON public.social_bridge_tokens(token_hash);

ALTER TABLE public.social_bridge_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_bridge_tokens_company_isolation ON public.social_bridge_tokens;
CREATE POLICY social_bridge_tokens_company_isolation
    ON public.social_bridge_tokens
    FOR ALL TO authenticated
    USING (company_id = public.get_auth_company_id())
    WITH CHECK (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS social_bridge_tokens_super_admin ON public.social_bridge_tokens;
CREATE POLICY social_bridge_tokens_super_admin
    ON public.social_bridge_tokens
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
        )
    );

-- 3. One-time OAuth 2.0 authorization codes for 1-click Custom GPT sign-in
CREATE TABLE IF NOT EXISTS public.social_bridge_oauth_codes (
    code_hash            TEXT PRIMARY KEY,
    company_id           UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    client_id            TEXT NOT NULL,
    redirect_uri         TEXT NOT NULL,
    can_publish_directly BOOLEAN NOT NULL DEFAULT true,
    expires_at           TIMESTAMPTZ NOT NULL,
    used_at              TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_bridge_oauth_codes_expires
    ON public.social_bridge_oauth_codes(expires_at);

ALTER TABLE public.social_bridge_oauth_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_bridge_oauth_codes_deny_all ON public.social_bridge_oauth_codes;
CREATE POLICY social_bridge_oauth_codes_deny_all
    ON public.social_bridge_oauth_codes
    FOR ALL TO authenticated, anon
    USING (false)
    WITH CHECK (false);

-- 4. Enable feature flag EXCLUSIVELY for Arias Defense / General
UPDATE public.companies
SET features = COALESCE(features, '{}'::jsonb) || '{"ai_content_studio_enabled": true}'::jsonb
WHERE id = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';

-- 5. Schedule 5-minute pg_cron auto-publisher for Planning posts
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.trigger_scheduled_social_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM net.http_post(
        url := 'https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/arias-social-bridge',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTg3NDAsImV4cCI6MjA4NTQ5NDc0MH0.ybK2j-anHpMIlgaH0D-pRz4W6kyb96fNsbXTfT2FE2o'
        ),
        body := '{"action":"process_due_scheduled"}'::jsonb
    );
END;
$$;

DO $$
BEGIN
    PERFORM cron.unschedule('process-scheduled-social-posts-5m');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
    'process-scheduled-social-posts-5m',
    '*/5 * * * *',
    'SELECT public.trigger_scheduled_social_posts()'
);
