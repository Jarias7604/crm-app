-- Migration: 20261031150000_sales_excellence_and_gemini_audits.sql
-- Description: Tables and RLS policies for Sales Excellence Playbook and Gemini Meeting Audits

CREATE TABLE IF NOT EXISTS public.sales_call_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    evaluated_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    auditor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    google_doc_url TEXT,
    meeting_notes_raw TEXT,
    total_score INT NOT NULL DEFAULT 0, -- 0 to 100
    rubric_scores JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of criteria evaluations
    coaching_summary JSONB DEFAULT '{}'::jsonb, -- { strength, critical_gap, recommended_roleplay, immediate_action }
    extracted_data JSONB DEFAULT '{}'::jsonb, -- { pain_point, estimated_cost, decision_maker, next_step, next_date }
    status TEXT NOT NULL DEFAULT 'completed', -- 'draft', 'completed', 'reviewed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for speedy queries
CREATE INDEX IF NOT EXISTS idx_sales_audits_lead_id ON public.sales_call_audits(lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_audits_company_user ON public.sales_call_audits(company_id, evaluated_user_id);
CREATE INDEX IF NOT EXISTS idx_sales_audits_created_at ON public.sales_call_audits(created_at DESC);

-- Enable RLS
ALTER TABLE public.sales_call_audits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_call_audits' AND policyname='sales_call_audits_select') THEN
        CREATE POLICY "sales_call_audits_select" ON public.sales_call_audits
            FOR SELECT TO authenticated
            USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_call_audits' AND policyname='sales_call_audits_insert') THEN
        CREATE POLICY "sales_call_audits_insert" ON public.sales_call_audits
            FOR INSERT TO authenticated
            WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_call_audits' AND policyname='sales_call_audits_update') THEN
        CREATE POLICY "sales_call_audits_update" ON public.sales_call_audits
            FOR UPDATE TO authenticated
            USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_call_audits' AND policyname='sales_call_audits_delete') THEN
        CREATE POLICY "sales_call_audits_delete" ON public.sales_call_audits
            FOR DELETE TO authenticated
            USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;
