-- =====================================================
-- MARKETING INTEGRATIONS SCHEMA
-- =====================================================

CREATE TABLE IF NOT EXISTS marketing_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    
    provider VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'email', -- 'email', 'whatsapp', 'telegram', 'chat'
    name VARCHAR(100) DEFAULT 'Provider',
    
    -- Encrypted/Secured settings
    -- En producción real, "credentials" debería estar encriptado o en Vault.
    -- Por ahora guardaremos JSON simple para la demo funcional.
    settings JSONB DEFAULT '{}'::jsonb, 
    -- Estructura esperada settings: { email: "...", apiKey: "...", host: "..." }
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Restricción: Solo una integración activa por tipo por empresa (opcional)
    UNIQUE(company_id, provider)
);

-- RLS
ALTER TABLE marketing_integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Admin Access
CREATE POLICY "Admins can manage integrations" ON marketing_integrations FOR ALL TO authenticated USING (
    -- Check if user belongs to the company (Simplified for Phase 1)
    auth.uid() IN (SELECT id FROM profiles WHERE company_id = marketing_integrations.company_id) 
    OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);
