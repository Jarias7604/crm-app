-- ============================================================
-- SAAS INVOICES + USAGE METRICS RPCs
-- Full-stack billing infrastructure
-- Date: 2026-05-05
-- ============================================================

-- ============================================================
-- 1. TABLE: saas_invoices (Invoice history per tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saas_invoices (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    subscription_id     uuid REFERENCES public.company_subscriptions(id) ON DELETE SET NULL,
    invoice_number      text NOT NULL,               -- 'INV-2026-ADM-001'
    stripe_invoice_id   text,                        -- Stripe invoice ID for reconciliation
    amount              numeric(10,2) NOT NULL DEFAULT 0,
    currency            text NOT NULL DEFAULT 'usd',
    status              text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('draft', 'pending', 'paid', 'failed', 'refunded', 'void')),
    plan_slug           text,                        -- Snapshot of plan at invoice time
    plan_name           text,
    billing_period_start timestamptz,
    billing_period_end  timestamptz,
    issued_at           timestamptz NOT NULL DEFAULT now(),
    paid_at             timestamptz,
    due_at              timestamptz,
    stripe_hosted_url   text,                        -- Link to Stripe-hosted invoice
    pdf_url             text,                        -- Direct PDF download URL from Stripe
    metadata            jsonb DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saas_invoices ENABLE ROW LEVEL SECURITY;

-- Company admins can read their own invoices
DROP POLICY IF EXISTS "invoices_company_read" ON public.saas_invoices;
CREATE POLICY "invoices_company_read" ON public.saas_invoices
    FOR SELECT TO authenticated
    USING (company_id = (SELECT get_auth_company_id()));

-- Super admin can do everything
DROP POLICY IF EXISTS "invoices_super_admin_all" ON public.saas_invoices;
CREATE POLICY "invoices_super_admin_all" ON public.saas_invoices
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'super_admin' OR is_platform_owner = true))
    );

-- Index for fast lookup by company + date
CREATE INDEX IF NOT EXISTS idx_saas_invoices_company_date
    ON public.saas_invoices (company_id, issued_at DESC);

-- Unique invoice numbers per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_invoices_number_unique
    ON public.saas_invoices (company_id, invoice_number);

-- ============================================================
-- 2. RPC: get_company_invoices (Fetch invoice history)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_company_invoices(
    p_limit integer DEFAULT 20,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    invoice_id          uuid,
    invoice_number      text,
    amount              numeric,
    currency            text,
    status              text,
    plan_name           text,
    plan_slug           text,
    billing_period_start timestamptz,
    billing_period_end  timestamptz,
    issued_at           timestamptz,
    paid_at             timestamptz,
    due_at              timestamptz,
    stripe_hosted_url   text,
    pdf_url             text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        si.id,
        si.invoice_number,
        si.amount,
        si.currency,
        si.status,
        si.plan_name,
        si.plan_slug,
        si.billing_period_start,
        si.billing_period_end,
        si.issued_at,
        si.paid_at,
        si.due_at,
        si.stripe_hosted_url,
        si.pdf_url
    FROM public.saas_invoices si
    WHERE si.company_id = get_auth_company_id()
    ORDER BY si.issued_at DESC
    LIMIT p_limit
    OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_invoices(integer, integer) TO authenticated;

-- ============================================================
-- 3. RPC: get_usage_summary (Aggregated usage for current cycle)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_usage_summary()
RETURNS TABLE (
    event_type  text,
    total       bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        ue.event_type,
        COALESCE(SUM(ue.quantity), 0)::bigint AS total
    FROM public.usage_events ue
    JOIN public.company_subscriptions cs ON cs.company_id = ue.company_id
    WHERE ue.company_id = get_auth_company_id()
      AND ue.created_at >= COALESCE(cs.current_period_start, date_trunc('month', now()))
    GROUP BY ue.event_type;
$$;

GRANT EXECUTE ON FUNCTION public.get_usage_summary() TO authenticated;

-- ============================================================
-- 4. SEED: Generate initial invoices for existing subscriptions
-- ============================================================
DO $$
DECLARE
    v_sub RECORD;
    v_month_offset integer;
    v_invoice_date timestamptz;
    v_seq text;
BEGIN
    FOR v_sub IN
        SELECT cs.id AS sub_id, cs.company_id, sp.slug, sp.name, sp.price_monthly, cs.current_period_start
        FROM public.company_subscriptions cs
        JOIN public.saas_plans sp ON cs.plan_id = sp.id
    LOOP
        -- Generate 3 months of history
        FOR v_month_offset IN 0..2 LOOP
            v_invoice_date := COALESCE(v_sub.current_period_start, now()) - (v_month_offset * interval '1 month');
            v_seq := LPAD((3 - v_month_offset)::text, 3, '0');

            INSERT INTO public.saas_invoices (
                company_id, subscription_id, invoice_number, amount, currency, status,
                plan_slug, plan_name, billing_period_start, billing_period_end,
                issued_at, paid_at, due_at
            ) VALUES (
                v_sub.company_id,
                v_sub.sub_id,
                'INV-' || to_char(v_invoice_date, 'YYYY') || '-' || v_seq,
                v_sub.price_monthly,
                'usd',
                CASE WHEN v_month_offset = 0 THEN 'pending' ELSE 'paid' END,
                v_sub.slug,
                v_sub.name,
                v_invoice_date,
                v_invoice_date + interval '1 month',
                v_invoice_date,
                CASE WHEN v_month_offset > 0 THEN v_invoice_date + interval '2 days' ELSE NULL END,
                v_invoice_date + interval '15 days'
            )
            ON CONFLICT (company_id, invoice_number) DO NOTHING;
        END LOOP;
    END LOOP;
END;
$$;

SELECT 'SaaS Invoices + Usage RPCs migration applied successfully!' AS result;
