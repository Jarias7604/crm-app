-- =====================================================
-- TABLA: cotizaciones
-- Sistema de Cotizaciones de Facturación Electrónica
-- =====================================================

CREATE TABLE IF NOT EXISTS cotizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    
    -- Información del Cliente
    nombre_cliente TEXT NOT NULL,
    empresa_cliente TEXT,
    email_cliente TEXT,
    telefono_cliente TEXT,
    
    -- Configuración del Plan
    volumen_dtes INTEGER NOT NULL CHECK (volumen_dtes >= 0),
    plan_nombre TEXT NOT NULL, -- BASIC, STARTER, PRO, ENTERPRISE
    costo_plan_anual DECIMAL(10,2) NOT NULL DEFAULT 0,
    costo_plan_mensual DECIMAL(10,2) NOT NULL DEFAULT 0,
    costo_implementacion DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Módulos Adicionales (JSONB)
    modulos_adicionales JSONB DEFAULT '[]'::jsonb,
    -- Ejemplo: [{"nombre": "POS", "costo_anual": 300, "costo_mensual": 30}]
    
    -- Servicios Adicionales
    servicio_whatsapp BOOLEAN DEFAULT false,
    costo_whatsapp DECIMAL(10,2) DEFAULT 0,
    servicio_personalizacion BOOLEAN DEFAULT false,
    costo_personalizacion DECIMAL(10,2) DEFAULT 0,
    
    -- Totales Calculados
    subtotal_anual DECIMAL(10,2) NOT NULL DEFAULT 0,
    subtotal_mensual DECIMAL(10,2) NOT NULL DEFAULT 0,
    descuento_porcentaje DECIMAL(5,2) DEFAULT 0 CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
    descuento_monto DECIMAL(10,2) DEFAULT 0,
    total_anual DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_mensual DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Estado y Seguimiento
    estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'enviada', 'aceptada', 'rechazada', 'expirada')),
    valida_hasta DATE,
    notas TEXT,
    
    -- Auditoría
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cotizaciones_company ON cotizaciones(company_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_lead ON cotizaciones(lead_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_created_at ON cotizaciones(created_at DESC);

-- RLS Policies
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;

-- Super Admin: Full access
CREATE POLICY "Super admins have full access to all cotizaciones"
    ON cotizaciones FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- Company Users: Access only their company's cotizaciones
CREATE POLICY "Users can view their company cotizaciones"
    ON cotizaciones FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Company admins can insert cotizaciones"
    ON cotizaciones FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid()
            AND role IN ('company_admin', 'sales_agent')
        )
    );

CREATE POLICY "Company admins can update their cotizaciones"
    ON cotizaciones FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid()
            AND role IN ('company_admin', 'sales_agent')
        )
    );

CREATE POLICY "Company admins can delete their cotizaciones"
    ON cotizaciones FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid()
            AND role = 'company_admin'
        )
    );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_cotizaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cotizaciones_updated_at
    BEFORE UPDATE ON cotizaciones
    FOR EACH ROW
    EXECUTE FUNCTION update_cotizaciones_updated_at();

COMMENT ON TABLE cotizaciones IS 'Cotizaciones de Facturación Electrónica con planes y módulos';
