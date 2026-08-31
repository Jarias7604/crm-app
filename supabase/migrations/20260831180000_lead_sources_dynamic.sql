-- ============================================================
-- lead_sources — Dynamic per-company lead source catalog
-- Same pattern as lead_products
-- 2026-08-31
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_sources (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    slug        TEXT        NOT NULL,          -- machine-readable key (e.g. 'facebook_ads')
    icon        TEXT        NOT NULL DEFAULT '📋',
    color       TEXT        NOT NULL DEFAULT 'text-gray-700',
    bg_color    TEXT        NOT NULL DEFAULT 'bg-gray-100',
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    is_system   BOOLEAN     NOT NULL DEFAULT FALSE, -- system sources can't be deleted
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, slug)
);

-- RLS
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_sources_company_isolation" ON lead_sources
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
            UNION
            SELECT c.id FROM companies c
            JOIN companies parent ON c.parent_company_id = parent.id
            JOIN profiles p ON p.company_id = parent.id
            WHERE p.id = auth.uid()
        )
    );

-- Index
CREATE INDEX IF NOT EXISTS idx_lead_sources_company_id ON lead_sources(company_id);
CREATE INDEX IF NOT EXISTS idx_lead_sources_slug       ON lead_sources(company_id, slug);

-- ── Seed function: creates default sources for a company ──
CREATE OR REPLACE FUNCTION seed_lead_sources(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO lead_sources (company_id, name, slug, icon, color, bg_color, is_system)
    VALUES
        (p_company_id, 'Facebook Ads',  'facebook_ads',  '📢', 'text-blue-700',   'bg-blue-100',   TRUE),
        (p_company_id, 'WhatsApp',      'whatsapp',      '💬', 'text-emerald-700','bg-emerald-100', TRUE),
        (p_company_id, 'Redes Sociales','redes_sociales','📱', 'text-pink-700',   'bg-pink-100',    FALSE),
        (p_company_id, 'Referidos',     'referidos',     '🤝', 'text-purple-700', 'bg-purple-100',  FALSE),
        (p_company_id, 'Sitio Web',     'sitio_web',     '🌐', 'text-sky-700',    'bg-sky-100',     FALSE),
        (p_company_id, 'Visita Campo',  'visita_campo',  '🚗', 'text-green-700',  'bg-green-100',   FALSE),
        (p_company_id, 'Llamada Fría',  'llamada_fria',  '📞', 'text-orange-700', 'bg-orange-100',  FALSE),
        (p_company_id, 'Evento',        'evento',        '🎪', 'text-indigo-700', 'bg-indigo-100',  FALSE),
        (p_company_id, 'Otro',          'otro',          '📋', 'text-gray-700',   'bg-gray-100',    FALSE)
    ON CONFLICT (company_id, slug) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ── Seed all existing companies immediately ──
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM companies LOOP
        PERFORM seed_lead_sources(r.id);
    END LOOP;
END;
$$;

-- ── Auto-seed when a new company is created ──
CREATE OR REPLACE FUNCTION auto_seed_lead_sources()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM seed_lead_sources(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_seed_lead_sources ON companies;
CREATE TRIGGER trg_auto_seed_lead_sources
    AFTER INSERT ON companies
    FOR EACH ROW
    EXECUTE FUNCTION auto_seed_lead_sources();
