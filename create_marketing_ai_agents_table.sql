-- Tabla para Agentes AI de Marketing
-- Esta tabla almacena la configuración de los bots de IA para cada empresa

CREATE TABLE IF NOT EXISTS marketing_ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Asistente IA',
    role_description TEXT NOT NULL DEFAULT 'Consultor experto',
    tone VARCHAR(50) NOT NULL DEFAULT 'professional' CHECK (tone IN ('professional', 'friendly', 'aggressive', 'empathetic')),
    language VARCHAR(10) NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en', 'pt')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    active_channels TEXT[] DEFAULT ARRAY['telegram', 'whatsapp', 'web'],
    system_prompt TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraint: Una empresa solo puede tener un agente activo a la vez
    CONSTRAINT unique_active_agent_per_company UNIQUE (company_id, is_active)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_marketing_ai_agents_company ON marketing_ai_agents(company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_ai_agents_active ON marketing_ai_agents(is_active) WHERE is_active = true;

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_marketing_ai_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_marketing_ai_agents_updated_at
    BEFORE UPDATE ON marketing_ai_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_marketing_ai_agents_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Habilitar RLS
ALTER TABLE marketing_ai_agents ENABLE ROW LEVEL SECURITY;

-- Policy 1: Super Admin puede ver todos los agentes
CREATE POLICY "Super admins can view all AI agents"
    ON marketing_ai_agents
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- Policy 2: Company Admin y Sales Agents pueden ver agentes de su empresa
CREATE POLICY "Company members can view their company AI agents"
    ON marketing_ai_agents
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE profiles.id = auth.uid()
        )
    );

-- Policy 3: Super Admin puede insertar agentes en cualquier empresa
CREATE POLICY "Super admins can insert AI agents"
    ON marketing_ai_agents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- Policy 4: Company Admin puede insertar agentes en su empresa
CREATE POLICY "Company admins can insert AI agents for their company"
    ON marketing_ai_agents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_admin', 'super_admin')
        )
    );

-- Policy 5: Super Admin puede actualizar cualquier agente
CREATE POLICY "Super admins can update all AI agents"
    ON marketing_ai_agents
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- Policy 6: Company Admin puede actualizar agentes de su empresa
CREATE POLICY "Company admins can update their company AI agents"
    ON marketing_ai_agents
    FOR UPDATE
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_admin', 'super_admin')
        )
    );

-- Policy 7: Super Admin puede eliminar cualquier agente
CREATE POLICY "Super admins can delete all AI agents"
    ON marketing_ai_agents
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- Policy 8: Company Admin puede eliminar agentes de su empresa
CREATE POLICY "Company admins can delete their company AI agents"
    ON marketing_ai_agents
    FOR DELETE
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_admin', 'super_admin')
        )
    );

-- ============================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE marketing_ai_agents IS 'Configuración de agentes de IA para marketing y ventas por empresa';
COMMENT ON COLUMN marketing_ai_agents.id IS 'Identificador único del agente';
COMMENT ON COLUMN marketing_ai_agents.company_id IS 'Empresa a la que pertenece el agente';
COMMENT ON COLUMN marketing_ai_agents.name IS 'Nombre del agente (ej: "Asistente IA", "Bot Comercial")';
COMMENT ON COLUMN marketing_ai_agents.role_description IS 'Descripción del rol del agente (ej: "Consultor experto en facturación")';
COMMENT ON COLUMN marketing_ai_agents.tone IS 'Tono de comunicación: professional, friendly, aggressive, empathetic';
COMMENT ON COLUMN marketing_ai_agents.language IS 'Idioma principal: es (español), en (inglés), pt (portugués)';
COMMENT ON COLUMN marketing_ai_agents.is_active IS 'Si el agente está activo y respondiendo';
COMMENT ON COLUMN marketing_ai_agents.active_channels IS 'Canales donde el agente está activo: telegram, whatsapp, web';
COMMENT ON COLUMN marketing_ai_agents.system_prompt IS 'Instrucciones del sistema para la IA (prompt base)';
