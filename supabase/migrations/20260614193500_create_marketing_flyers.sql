-- Migration: 20260614193500_create_marketing_flyers.sql
-- Description: Create marketing_flyers table for FlyerStudio saved designs

CREATE TABLE IF NOT EXISTS public.marketing_flyers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id),
  name            VARCHAR(255) NOT NULL,
  format          VARCHAR(50) NOT NULL,
  template_id     VARCHAR(50) NOT NULL,
  bg_image_url    TEXT,
  settings        JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_marketing_flyers_company ON public.marketing_flyers(company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_flyers_created ON public.marketing_flyers(created_at DESC);

-- Enable RLS
ALTER TABLE public.marketing_flyers ENABLE ROW LEVEL SECURITY;

-- Policies (Tenant isolation matching CRM standards)
CREATE POLICY "company_all_marketing_flyers" ON public.marketing_flyers
  FOR ALL TO authenticated
  USING (company_id = public.get_auth_company_id())
  WITH CHECK (company_id = public.get_auth_company_id());

CREATE POLICY "super_admin_marketing_flyers" ON public.marketing_flyers
  FOR ALL TO authenticated
  USING (public.get_auth_role() = 'super_admin');
