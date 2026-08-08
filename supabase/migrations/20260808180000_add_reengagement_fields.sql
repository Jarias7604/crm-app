-- ─────────────────────────────────────────────────────────────────────────────
-- Recovery Intelligence: re-engagement tracking fields on leads
-- When a "Llamada fría" or "En Nutrición" lead responds via WhatsApp (or email),
-- these fields record the full attribution so campaign ROI can be measured.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS reengaged_from TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS reengaged_via  TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS reengaged_at   TIMESTAMPTZ DEFAULT NULL;

-- Index for dashboard queries: "leads recovered this month" etc.
CREATE INDEX IF NOT EXISTS idx_leads_reengaged_at
    ON leads (company_id, reengaged_at)
    WHERE reengaged_at IS NOT NULL;

COMMENT ON COLUMN leads.reengaged_from IS 'Original pipeline segment status before re-engagement (e.g. "Llamada fría", "En Nutrición")';
COMMENT ON COLUMN leads.reengaged_via  IS 'Channel that triggered re-engagement: "whatsapp" | "email" | "sms"';
COMMENT ON COLUMN leads.reengaged_at   IS 'Timestamp when the lead responded and was moved back to the active pipeline';
