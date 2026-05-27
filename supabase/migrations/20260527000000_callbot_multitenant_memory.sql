-- ============================================================
-- SOFÍA AI CALLBOT — Multi-Tenant Memory System
-- Migration: 20260527000000_callbot_multitenant_memory.sql
-- 
-- ARQUITECTURA:
--   Cada empresa (tenant) tiene su propio asistente Vapi, 
--   su propio número, su propio script. Completamente aislados.
--   Esta tabla guarda la memoria persistente de cada lead
--   entre llamadas para que Sofía siempre sepa con quién habla.
-- ============================================================

-- ── call_memories: Memoria persistente por lead ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_memories (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lead_id             UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

    -- Datos del prospecto que Sofía recuerda
    prospect_name       TEXT,
    prospect_company    TEXT,
    prospect_role       TEXT,

    -- Estado de la relación
    interest_level      INTEGER DEFAULT 0 CHECK (interest_level >= 0 AND interest_level <= 10),
    current_status      TEXT NOT NULL DEFAULT 'cold'
                        CHECK (current_status IN ('cold','interested','objecting','demo_scheduled','demo_done','closed_won','closed_lost','follow_up')),

    -- Historial de conversación
    call_count          INTEGER NOT NULL DEFAULT 0,
    last_call_at        TIMESTAMPTZ,
    last_transcript_summary TEXT,       -- Resumen de la última llamada hecho por GPT
    objections          TEXT[],         -- Objeciones que ha mencionado

    -- Próximo paso acordado
    next_action         TEXT,           -- 'follow_up_call', 'send_demo', 'wait', 'close'
    next_action_date    TIMESTAMPTZ,
    demo_booked_at      TIMESTAMPTZ,
    demo_notes          TEXT,

    -- Metadata
    notes               TEXT,           -- Notas libres del agente
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un registro por lead por empresa
    UNIQUE (company_id, lead_id)
);

-- Índices para queries rápidas por empresa
CREATE INDEX IF NOT EXISTS idx_call_memories_company  ON public.call_memories(company_id);
CREATE INDEX IF NOT EXISTS idx_call_memories_lead     ON public.call_memories(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_memories_status   ON public.call_memories(company_id, current_status);
CREATE INDEX IF NOT EXISTS idx_call_memories_interest ON public.call_memories(company_id, interest_level DESC);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.update_call_memories_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_call_memories_updated_at ON public.call_memories;
CREATE TRIGGER trg_call_memories_updated_at
    BEFORE UPDATE ON public.call_memories
    FOR EACH ROW EXECUTE FUNCTION public.update_call_memories_updated_at();

-- ── RLS: Cada empresa solo ve sus propias memorias ────────────────────────────
ALTER TABLE public.call_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_memories_tenant_isolation" ON public.call_memories;
CREATE POLICY "call_memories_tenant_isolation" ON public.call_memories
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM public.user_profiles
            WHERE id = auth.uid()
        )
    );

-- Super admin puede ver todo (plataforma SaaS)
DROP POLICY IF EXISTS "call_memories_platform_admin" ON public.call_memories;
CREATE POLICY "call_memories_platform_admin" ON public.call_memories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Service role (Edge Functions) acceso total para webhooks
-- Ya tiene bypass de RLS por ser service_role

-- ── RPC: Upsert de memoria después de cada llamada ───────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_call_memory(
    p_company_id            UUID,
    p_lead_id               UUID,
    p_prospect_name         TEXT DEFAULT NULL,
    p_prospect_company      TEXT DEFAULT NULL,
    p_prospect_role         TEXT DEFAULT NULL,
    p_interest_level        INTEGER DEFAULT NULL,
    p_current_status        TEXT DEFAULT NULL,
    p_transcript_summary    TEXT DEFAULT NULL,
    p_objections            TEXT[] DEFAULT NULL,
    p_next_action           TEXT DEFAULT NULL,
    p_next_action_date      TIMESTAMPTZ DEFAULT NULL,
    p_demo_booked_at        TIMESTAMPTZ DEFAULT NULL,
    p_notes                 TEXT DEFAULT NULL
)
RETURNS public.call_memories
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_result public.call_memories;
BEGIN
    INSERT INTO public.call_memories (
        company_id, lead_id,
        prospect_name, prospect_company, prospect_role,
        interest_level, current_status,
        last_transcript_summary, objections,
        next_action, next_action_date, demo_booked_at, notes,
        call_count, last_call_at
    ) VALUES (
        p_company_id, p_lead_id,
        p_prospect_name, p_prospect_company, p_prospect_role,
        COALESCE(p_interest_level, 0), COALESCE(p_current_status, 'cold'),
        p_transcript_summary, p_objections,
        p_next_action, p_next_action_date, p_demo_booked_at, p_notes,
        1, NOW()
    )
    ON CONFLICT (company_id, lead_id) DO UPDATE SET
        prospect_name           = COALESCE(EXCLUDED.prospect_name, call_memories.prospect_name),
        prospect_company        = COALESCE(EXCLUDED.prospect_company, call_memories.prospect_company),
        prospect_role           = COALESCE(EXCLUDED.prospect_role, call_memories.prospect_role),
        interest_level          = COALESCE(EXCLUDED.interest_level, call_memories.interest_level),
        current_status          = COALESCE(EXCLUDED.current_status, call_memories.current_status),
        last_transcript_summary = COALESCE(EXCLUDED.last_transcript_summary, call_memories.last_transcript_summary),
        objections              = COALESCE(EXCLUDED.objections, call_memories.objections),
        next_action             = COALESCE(EXCLUDED.next_action, call_memories.next_action),
        next_action_date        = COALESCE(EXCLUDED.next_action_date, call_memories.next_action_date),
        demo_booked_at          = COALESCE(EXCLUDED.demo_booked_at, call_memories.demo_booked_at),
        notes                   = COALESCE(EXCLUDED.notes, call_memories.notes),
        call_count              = call_memories.call_count + 1,
        last_call_at            = NOW(),
        updated_at              = NOW()
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

-- ── Grant permisos ─────────────────────────────────────────────────────────────
GRANT ALL ON public.call_memories TO authenticated;
GRANT ALL ON public.call_memories TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_call_memory TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_call_memory TO service_role;
