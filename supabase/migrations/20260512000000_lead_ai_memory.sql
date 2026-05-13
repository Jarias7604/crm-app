-- ============================================================
-- LEAD AI MEMORY — "Lead Brain" System
-- Enables persistent memory across AI conversations
-- Each lead has ONE memory record that evolves over time
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lead_ai_memory (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id             uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

    -- What the bot knows about this lead
    known_facts         jsonb DEFAULT '{}'::jsonb,
    -- e.g.: { "volumen_dtes": 1200, "sector": "comercio", "decisor": "Patricia", "objeciones": ["precio"] }

    -- Current stage in the sales pipeline
    conversation_stage  text DEFAULT 'nuevo'
        CHECK (conversation_stage IN ('nuevo','calificado','cotizado','seguimiento','negociacion','cerrado','perdido')),

    -- Last objection raised by the lead
    last_objection      text,

    -- Emotional/engagement score 0-100
    sentiment_score     integer DEFAULT 50 CHECK (sentiment_score BETWEEN 0 AND 100),

    -- Best time to contact (from conversation patterns)
    best_contact_time   text,

    -- What the bot should do next
    next_action         text DEFAULT 'calificar',
    -- e.g.: 'calificar', 'enviar_propuesta', 'seguimiento', 'demo', 'llamada', 'escalar_humano'

    -- Auto-followup tracking
    followup_count      integer DEFAULT 0,
    last_followup_at    timestamptz,
    followup_paused     boolean DEFAULT false,

    -- Which message triggered the last followup
    last_followup_msg   text,

    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now(),

    UNIQUE(lead_id)
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lead_ai_memory_company_id   ON public.lead_ai_memory(company_id);
CREATE INDEX IF NOT EXISTS idx_lead_ai_memory_stage        ON public.lead_ai_memory(conversation_stage);
CREATE INDEX IF NOT EXISTS idx_lead_ai_memory_next_action  ON public.lead_ai_memory(next_action);
CREATE INDEX IF NOT EXISTS idx_lead_ai_memory_followup_at  ON public.lead_ai_memory(last_followup_at);

-- ── Auto-update updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_lead_ai_memory_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_lead_ai_memory_updated_at ON public.lead_ai_memory;
CREATE TRIGGER tr_lead_ai_memory_updated_at
    BEFORE UPDATE ON public.lead_ai_memory
    FOR EACH ROW EXECUTE FUNCTION public.update_lead_ai_memory_timestamp();

-- ── Row Level Security ─────────────────────────────────────────────────────────
ALTER TABLE public.lead_ai_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_lead_ai_memory"
ON public.lead_ai_memory FOR ALL
TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = (SELECT auth.uid())) = 'super_admin'
    OR company_id = (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))
)
WITH CHECK (
    (SELECT role FROM profiles WHERE id = (SELECT auth.uid())) = 'super_admin'
    OR company_id = (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))
);

-- ── Agent Cockpit View (for the dashboard metrics) ─────────────────────────────
CREATE OR REPLACE VIEW public.agent_cockpit_metrics AS
SELECT
    m.company_id,
    COUNT(*)                                                    AS total_leads_tracked,
    COUNT(*) FILTER (WHERE m.conversation_stage = 'nuevo')      AS leads_nuevos,
    COUNT(*) FILTER (WHERE m.conversation_stage = 'calificado') AS leads_calificados,
    COUNT(*) FILTER (WHERE m.conversation_stage = 'cotizado')   AS leads_cotizados,
    COUNT(*) FILTER (WHERE m.conversation_stage = 'seguimiento')AS leads_en_seguimiento,
    COUNT(*) FILTER (WHERE m.conversation_stage = 'cerrado')    AS leads_cerrados,
    COUNT(*) FILTER (WHERE m.conversation_stage = 'perdido')    AS leads_perdidos,
    ROUND(AVG(m.sentiment_score)::numeric, 1)                   AS avg_sentiment,
    COUNT(*) FILTER (WHERE m.next_action = 'escalar_humano')    AS pendientes_escalar,
    COUNT(*) FILTER (WHERE m.followup_count > 0)                AS en_seguimiento_auto,
    MAX(m.updated_at)                                           AS last_activity
FROM public.lead_ai_memory m
GROUP BY m.company_id;

-- Grant access
GRANT SELECT ON public.agent_cockpit_metrics TO authenticated;

-- ── Upsert helper function (used by Edge Function) ────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_lead_memory(
    p_lead_id     uuid,
    p_company_id  uuid,
    p_facts       jsonb DEFAULT NULL,
    p_stage       text DEFAULT NULL,
    p_objection   text DEFAULT NULL,
    p_sentiment   integer DEFAULT NULL,
    p_next_action text DEFAULT NULL
)
RETURNS public.lead_ai_memory
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_record public.lead_ai_memory;
BEGIN
    INSERT INTO public.lead_ai_memory (lead_id, company_id, known_facts, conversation_stage, last_objection, sentiment_score, next_action)
    VALUES (
        p_lead_id,
        p_company_id,
        COALESCE(p_facts, '{}'::jsonb),
        COALESCE(p_stage, 'nuevo'),
        p_objection,
        COALESCE(p_sentiment, 50),
        COALESCE(p_next_action, 'calificar')
    )
    ON CONFLICT (lead_id) DO UPDATE SET
        known_facts        = CASE WHEN p_facts IS NOT NULL
                                  THEN lead_ai_memory.known_facts || p_facts
                                  ELSE lead_ai_memory.known_facts END,
        conversation_stage = COALESCE(p_stage,       lead_ai_memory.conversation_stage),
        last_objection     = COALESCE(p_objection,   lead_ai_memory.last_objection),
        sentiment_score    = COALESCE(p_sentiment,   lead_ai_memory.sentiment_score),
        next_action        = COALESCE(p_next_action, lead_ai_memory.next_action),
        updated_at         = now()
    RETURNING * INTO v_record;
    RETURN v_record;
END;
$$;
