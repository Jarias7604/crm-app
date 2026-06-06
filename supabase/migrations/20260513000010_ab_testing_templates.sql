-- =============================================================================
-- A/B Testing de Templates de Seguimiento
-- Crea ai_followup_settings si no existe y agrega columnas A/B
-- =============================================================================

-- 1. Create table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS ai_followup_settings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    first_followup_hours    INTEGER NOT NULL DEFAULT 24,
    second_followup_hours   INTEGER NOT NULL DEFAULT 72,
    third_followup_hours    INTEGER NOT NULL DEFAULT 168,
    max_followups           INTEGER NOT NULL DEFAULT 3,
    auto_escalate           BOOLEAN NOT NULL DEFAULT TRUE,
    only_business_hours     BOOLEAN NOT NULL DEFAULT FALSE,
    timezone                TEXT    NOT NULL DEFAULT 'America/El_Salvador',
    pause_after_quote       BOOLEAN NOT NULL DEFAULT FALSE,
    followup_1_template     TEXT    DEFAULT NULL,
    followup_2_template     TEXT    DEFAULT NULL,
    followup_3_template     TEXT    DEFAULT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE ai_followup_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_access" ON ai_followup_settings;
CREATE POLICY "company_access" ON ai_followup_settings
    USING (company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
    ));

-- 2. A/B Testing columns (safe to run even if table already existed)
ALTER TABLE ai_followup_settings
    ADD COLUMN IF NOT EXISTS ab_testing_enabled    BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS followup_1_template_b TEXT    DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS followup_2_template_b TEXT    DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS followup_3_template_b TEXT    DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ab_stats JSONB DEFAULT '{
        "a_sent": 0, "b_sent": 0,
        "a_responses": 0, "b_responses": 0
    }'::jsonb;

-- 3. Helper function to increment A/B counters
CREATE OR REPLACE FUNCTION increment_ab_stat(
    p_company_id UUID,
    p_variant    TEXT,
    p_field      TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE ai_followup_settings
    SET ab_stats = jsonb_set(
        COALESCE(ab_stats, '{}'::jsonb),
        ARRAY[p_variant || '_' || p_field],
        to_jsonb(COALESCE((ab_stats->>(p_variant || '_' || p_field))::int, 0) + 1)
    )
    WHERE company_id = p_company_id;
END;
$$;
