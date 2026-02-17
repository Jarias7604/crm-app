-- =====================================================
-- MARKETING PLATFORM SCHEMA
-- =====================================================

-- 1. CAMPAIGNS (Email, WhatsApp, etc.)
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id), -- Null for Super Admin templates? No, campaigns are usually per company.
    name TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'whatsapp', 'social', 'sms')),
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'archived')),
    
    -- Targeting
    audience_filters JSONB DEFAULT '{}'::jsonb, -- Store filters to define who gets this (e.g. { "tag": "vip", "city": "miami" })
    total_recipients INTEGER DEFAULT 0,
    
    -- Content
    subject TEXT, -- For Email
    content TEXT, -- HTML body or Message text
    template_id UUID,
    
    -- Schedule
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    
    -- Stats
    stats JSONB DEFAULT '{
        "sent": 0,
        "delivered": 0,
        "opened": 0,
        "clicked": 0,
        "replied": 0,
        "bounced": 0
    }'::jsonb,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TEMPLATES (Reusable designs)
CREATE TABLE IF NOT EXISTS marketing_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id), -- Null = Global Template (Super Admin provided)
    name TEXT NOT NULL,
    channel VARCHAR(50) NOT NULL, -- email, whatsapp
    category VARCHAR(50), -- newsletter, promo, welcome
    
    subject TEXT,
    content JSONB, -- Rich text structure or HTML string
    thumbnail_url TEXT,
    
    is_global BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AI AGENTS (Configuration for Auto-responses)
CREATE TABLE IF NOT EXISTS marketing_ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    name TEXT NOT NULL,
    
    -- Persona
    role_description TEXT DEFAULT 'Asistente de Ventas',
    tone VARCHAR(50) DEFAULT 'professional', -- professional, friendly, aggressive
    language VARCHAR(10) DEFAULT 'es',
    
    -- Knowledge
    system_prompt TEXT, -- The "Brain" instructions
    knowledge_sources JSONB DEFAULT '[]'::jsonb, -- Links to PDFs, Products, FAQs
    
    -- Configuration
    is_active BOOLEAN DEFAULT false,
    active_channels VARCHAR[] DEFAULT ARRAY['web_chat'], -- ['whatsapp', 'email', 'web_chat']
    
    -- Limits
    max_replies_per_user INTEGER DEFAULT 10,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LEAD HUNTER SEARCHES (History of discovered leads)
CREATE TABLE IF NOT EXISTS marketing_lead_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    
    search_query TEXT NOT NULL, -- e.g. "Dentists in Miami"
    source VARCHAR(50) DEFAULT 'google_maps',
    
    results_found INTEGER DEFAULT 0,
    results_imported INTEGER DEFAULT 0,
    
    filters_used JSONB,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDICES
CREATE INDEX idx_campaigns_company ON marketing_campaigns(company_id);
CREATE INDEX idx_campaigns_status ON marketing_campaigns(status);
CREATE INDEX idx_templates_global ON marketing_templates(company_id) WHERE company_id IS NULL;

-- RLS POLICIES (Preliminary)
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_lead_searches ENABLE ROW LEVEL SECURITY;

-- Super Admin: Full Access
CREATE POLICY "Super Admin: Full Access Campaigns" ON marketing_campaigns FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Company Admin: Access Own Data (We will enable this later for clients)
-- For now, we will just use the Super Admin policy as requested for Phase 1.
