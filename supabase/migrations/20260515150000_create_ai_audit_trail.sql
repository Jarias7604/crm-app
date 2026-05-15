-- ============================================================================
-- AI Audit Trail — Decision Log & Transparency Layer
-- ============================================================================
-- Stores every autonomous decision made by AI agents (Sofía, Oracle, Maya, etc.)
-- Append-only design: no updates or deletes allowed via application code.
-- RLS: tenant isolation via get_auth_company_id() — same pattern as lead_ai_memory.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_audit_trail (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
    agent_name text NOT NULL DEFAULT 'sofia',
    decision_type text NOT NULL,
    reasoning text NOT NULL,
    context_snapshot jsonb DEFAULT '{}',
    outcome text,
    confidence integer DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
    created_at timestamptz DEFAULT now()
);

-- ── Performance indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_trail_company
    ON ai_audit_trail(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_lead
    ON ai_audit_trail(lead_id, created_at DESC)
    WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_trail_agent
    ON ai_audit_trail(company_id, agent_name, created_at DESC);

-- ── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE ai_audit_trail ENABLE ROW LEVEL SECURITY;

-- Tenant isolation — same proven pattern as the rest of the CRM
CREATE POLICY "audit_trail_tenant_isolation"
    ON ai_audit_trail
    FOR ALL
    USING (company_id = get_auth_company_id())
    WITH CHECK (company_id = get_auth_company_id());

-- ── Comments ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE ai_audit_trail IS 'Stores every autonomous AI decision for transparency and auditing';
COMMENT ON COLUMN ai_audit_trail.agent_name IS 'Which AI agent made this decision: sofia, oracle, maya, atlas, callbot, orchestrator, autopilot';
COMMENT ON COLUMN ai_audit_trail.decision_type IS 'Category of the decision: message_sent, lead_scored, escalated_to_human, etc.';
COMMENT ON COLUMN ai_audit_trail.reasoning IS 'Human-readable explanation in Spanish of WHY this decision was made';
COMMENT ON COLUMN ai_audit_trail.context_snapshot IS 'JSON snapshot of the lead/system state at the time of the decision';
COMMENT ON COLUMN ai_audit_trail.outcome IS 'Result of the decision (filled in later when known): responded, converted, no_response, etc.';
COMMENT ON COLUMN ai_audit_trail.confidence IS 'How confident the agent was in this decision (0-100)';
