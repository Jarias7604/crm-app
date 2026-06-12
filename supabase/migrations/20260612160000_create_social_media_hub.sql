-- ================================================================
-- SOCIAL MEDIA HUB — Tablas base
-- Proyecto: crm-app (mtxqqamitglhehaktgxm)
-- Fecha: 2026-06-12
-- NO modifica tablas existentes
-- ================================================================

-- 1. Cuentas de redes sociales conectadas por empresa
CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    platform VARCHAR(30) NOT NULL,      -- 'facebook' | 'instagram' | 'tiktok' | 'youtube'
    account_name VARCHAR(200),
    account_id VARCHAR(200),            -- Page ID / Channel ID / TikTok user ID
    avatar_url TEXT,
    access_token TEXT,
    token_expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',        -- { page_id, channel_id, instagram_business_id, etc }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, platform, account_id)
);

-- 2. Posts programados / publicados
CREATE TABLE IF NOT EXISTS social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    content_url TEXT,                   -- URL del flyer/video en Storage
    content_type VARCHAR(20) NOT NULL DEFAULT 'image', -- 'image' | 'video' | 'reel' | 'story'
    captions JSONB DEFAULT '{}',        -- { facebook: '...', instagram: '...', tiktok: '...' }
    platforms TEXT[] DEFAULT '{}',      -- ['facebook', 'instagram']
    status VARCHAR(20) DEFAULT 'draft', -- 'draft' | 'publishing' | 'published' | 'scheduled' | 'failed'
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    results JSONB DEFAULT '{}',         -- { facebook: { post_id, error }, instagram: { ... } }
    flyer_id UUID,                      -- Referencia opcional al flyer de FlyerStudio
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

-- Políticas: mismo patrón que el resto del CRM
CREATE POLICY "social_accounts_company_isolation" ON social_accounts
    FOR ALL TO authenticated
    USING (company_id = get_auth_company_id())
    WITH CHECK (company_id = get_auth_company_id());

CREATE POLICY "social_posts_company_isolation" ON social_posts
    FOR ALL TO authenticated
    USING (company_id = get_auth_company_id())
    WITH CHECK (company_id = get_auth_company_id());

-- Super admin bypass
CREATE POLICY "social_accounts_super_admin" ON social_accounts
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "social_posts_super_admin" ON social_posts
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_social_accounts_company ON social_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_company ON social_posts(company_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status, scheduled_at);
