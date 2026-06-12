-- ═══════════════════════════════════════════════════════════════════════════
-- AI Generation Credits — per-company credit tracking for gpt-image-1 flyers
-- Migration: 20260612000000_ai_flyer_credits.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- Credits table (one row per company, reset monthly)
CREATE TABLE IF NOT EXISTS public.ai_generation_credits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  credits_used    INT  NOT NULL DEFAULT 0,
  credits_limit   INT  NOT NULL DEFAULT 20,       -- default Pro plan: 20 flyers/month
  period_start    TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  reset_at        TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + INTERVAL '1 month'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_company_period UNIQUE (company_id, period_start)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_credits_company ON public.ai_generation_credits(company_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_ai_credits_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_credits_updated_at ON public.ai_generation_credits;
CREATE TRIGGER trg_ai_credits_updated_at
  BEFORE UPDATE ON public.ai_generation_credits
  FOR EACH ROW EXECUTE FUNCTION public.touch_ai_credits_updated_at();

-- RLS
ALTER TABLE public.ai_generation_credits ENABLE ROW LEVEL SECURITY;

-- Company admins and super admins can see their own credits
CREATE POLICY "company_see_own_credits" ON public.ai_generation_credits
  FOR SELECT USING (company_id = public.get_auth_company_id());

CREATE POLICY "company_update_own_credits" ON public.ai_generation_credits
  FOR ALL USING (company_id = public.get_auth_company_id());

-- Super admin sees all
CREATE POLICY "super_admin_all_credits" ON public.ai_generation_credits
  FOR ALL USING (public.get_auth_role() = 'super_admin');

-- ─── ai_generated_flyers: log of every generated flyer ──────────────────────
CREATE TABLE IF NOT EXISTS public.ai_generated_flyers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id),
  prompt_used     TEXT,
  format          TEXT,            -- 'ig-post', 'fb-post', etc.
  tone            TEXT,
  image_urls      TEXT[],          -- array of 1..3 generated URLs
  selected_url    TEXT,            -- the one the user chose
  published_at    TIMESTAMPTZ,
  credits_spent   INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_flyers_company ON public.ai_generated_flyers(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_flyers_created ON public.ai_generated_flyers(created_at DESC);

ALTER TABLE public.ai_generated_flyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_see_own_flyers" ON public.ai_generated_flyers
  FOR SELECT USING (company_id = public.get_auth_company_id());

CREATE POLICY "company_insert_flyers" ON public.ai_generated_flyers
  FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());

CREATE POLICY "super_admin_all_flyers" ON public.ai_generated_flyers
  FOR ALL USING (public.get_auth_role() = 'super_admin');

-- ─── Helper RPC: check and deduct credits atomically ────────────────────────
CREATE OR REPLACE FUNCTION public.consume_ai_flyer_credits(
  p_company_id    UUID,
  p_count         INT DEFAULT 1   -- number of variants to generate
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_row           public.ai_generation_credits%ROWTYPE;
  v_period_start  TIMESTAMPTZ := date_trunc('month', now());
  v_reset_at      TIMESTAMPTZ := date_trunc('month', now()) + INTERVAL '1 month';
BEGIN
  -- Upsert current period row
  INSERT INTO public.ai_generation_credits (company_id, credits_used, credits_limit, period_start, reset_at)
  VALUES (p_company_id, 0, 20, v_period_start, v_reset_at)
  ON CONFLICT (company_id, period_start) DO NOTHING;

  -- Lock row for update
  SELECT * INTO v_row
  FROM public.ai_generation_credits
  WHERE company_id = p_company_id AND period_start = v_period_start
  FOR UPDATE;

  -- Check availability
  IF (v_row.credits_limit - v_row.credits_used) < p_count THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'reason',  'insufficient_credits',
      'used',    v_row.credits_used,
      'limit',   v_row.credits_limit,
      'remaining', v_row.credits_limit - v_row.credits_used
    );
  END IF;

  -- Deduct credits
  UPDATE public.ai_generation_credits
  SET credits_used = credits_used + p_count
  WHERE company_id = p_company_id AND period_start = v_period_start;

  RETURN jsonb_build_object(
    'ok',        true,
    'used',      v_row.credits_used + p_count,
    'limit',     v_row.credits_limit,
    'remaining', v_row.credits_limit - v_row.credits_used - p_count
  );
END;
$$;
