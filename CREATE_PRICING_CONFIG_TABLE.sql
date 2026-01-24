-- =====================================================
-- TABLA: pricing_items
-- Configuración dinámica de precios para cotizaciones
-- =====================================================

CREATE TABLE IF NOT EXISTS pricing_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Tipo de ítem
    tipo TEXT NOT NULL CHECK (tipo IN ('plan', 'modulo', 'servicio', 'implementacion')),
    
    -- Información básica
    nombre TEXT NOT NULL,
    descripcion TEXT,
    codigo TEXT, -- Código interno para referencia
    
    -- Precios
    precio_anual DECIMAL(10,2) DEFAULT 0,
    precio_mensual DECIMAL(10,2) DEFAULT 0,
    costo_unico DECIMAL(10,2) DEFAULT 0, -- Para ítems de pago único
    
    -- Rangos de DTEs (solo para planes)
    min_dtes INTEGER,
    max_dtes INTEGER,
    
    -- Precio por DTE (para servicios como WhatsApp)
    precio_por_dte DECIMAL(10,4) DEFAULT 0,
    
    -- Control
    activo BOOLEAN DEFAULT true,
    predeterminado BOOLEAN DEFAULT false, -- Si se incluye automáticamente
    orden INTEGER DEFAULT 0, -- Para ordenar en la UI
    
    -- Metadatos adicionales (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Ejemplo: {"caracteristicas": ["API completa", "Soporte 24/7"], "icono": "package"}
    
    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pricing_items_company ON pricing_items(company_id);
CREATE INDEX IF NOT EXISTS idx_pricing_items_tipo ON pricing_items(tipo);
CREATE INDEX IF NOT EXISTS idx_pricing_items_activo ON pricing_items(activo);

-- RLS
ALTER TABLE pricing_items ENABLE ROW LEVEL SECURITY;

-- Super Admin: Full access
CREATE POLICY "Super admins have full access to all pricing items"
    ON pricing_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- Company: Access their own config (if company_id is NULL, it's global)
CREATE POLICY "Users can view pricing items"
    ON pricing_items FOR SELECT
    USING (
        company_id IS NULL OR
        company_id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid()
        )
    );

-- Only company admins can manage
CREATE POLICY "Company admins can manage pricing items"
    ON pricing_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'company_admin')
            AND (pricing_items.company_id IS NULL OR profiles.company_id = pricing_items.company_id)
        )
    );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_pricing_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pricing_items_updated_at
    BEFORE UPDATE ON pricing_items
    FOR EACH ROW
    EXECUTE FUNCTION update_pricing_items_updated_at();

-- =====================================================
-- DATOS INICIALES (SEED)
-- =====================================================

-- PLANES BASE
INSERT INTO pricing_items (company_id, tipo, nombre, descripcion, precio_anual, precio_mensual, costo_unico, min_dtes, max_dtes, orden, metadata) VALUES
(NULL, 'plan', 'BASIC', 'Plan básico para pequeñas empresas', 600, 60, 50, 0, 500, 1, '{"caracteristicas": ["Hasta 500 DTEs/año", "Emisión de Facturas y CCF", "Portal del Cliente", "Soporte por Email"]}'::jsonb),
(NULL, 'plan', 'STARTER', 'Plan inicial para empresas en crecimiento', 1200, 120, 100, 501, 3000, 2, '{"caracteristicas": ["Hasta 3,000 DTEs/año", "Todos los documentos DTE", "Portal del Cliente", "Soporte Prioritario", "Reportes Básicos"]}'::jsonb),
(NULL, 'plan', 'PRO', 'Plan profesional para empresas establecidas', 2400, 240, 200, 3001, 10000, 3, '{"caracteristicas": ["Hasta 10,000 DTEs/año", "Todos los documentos DTE", "Soporte 24/7", "Reportes Avanzados", "API de Integración"]}'::jsonb),
(NULL, 'plan', 'ENTERPRISE', 'Plan empresarial sin límites', 4800, 480, 500, 10001, 999999, 4, '{"caracteristicas": ["DTEs Ilimitados", "Múltiples Sucursales", "Soporte Dedicado", "Reportes Personalizados", "API Completa", "Integración ERP"]}'::jsonb);

-- MÓDULOS ADICIONALES
INSERT INTO pricing_items (company_id, tipo, nombre, descripcion, codigo, precio_anual, precio_mensual, orden, metadata) VALUES
(NULL, 'modulo', 'POS', 'Punto de Venta Integrado', 'MOD_POS', 360, 36, 1, '{"icono": "shopping-cart"}'::jsonb),
(NULL, 'modulo', 'Cuentas por Cobrar', 'Gestión de cuentas por cobrar', 'MOD_CXC', 300, 30, 2, '{"icono": "dollar-sign"}'::jsonb),
(NULL, 'modulo', 'Comisiones', 'Cálculo automático de comisiones', 'MOD_COMISIONES', 240, 24, 3, '{"icono": "percent"}'::jsonb),
(NULL, 'modulo', 'Compras', 'Módulo de Gestión de Compras', 'MOD_COMPRAS', 300, 30, 4, '{"icono": "shopping-bag"}'::jsonb),
(NULL, 'modulo', 'Producción', 'Control de producción y manufactura', 'MOD_PRODUCCION', 480, 48, 5, '{"icono": "settings"}'::jsonb),
(NULL, 'modulo', 'Inventario', 'Control de Inventario Avanzado', 'MOD_INVENTARIO', 240, 24, 6, '{"icono": "package"}'::jsonb),
(NULL, 'modulo', 'Contabilidad', 'Módulo Contable Integrado', 'MOD_CONTABILIDAD', 480, 48, 7, '{"icono": "book"}'::jsonb),
(NULL, 'modulo', 'Nómina', 'Gestión de Planilla y RRHH', 'MOD_NOMINA', 600, 60, 8, '{"icono": "users"}'::jsonb);

-- SERVICIOS ADICIONALES
INSERT INTO pricing_items (company_id, tipo, nombre, descripcion, codigo, precio_anual, precio_mensual, costo_unico, orden, metadata) VALUES
(NULL, 'servicio', 'Personalización de Tickets', 'Diseño personalizado de tickets de venta', 'SRV_TICKETS', 0, 0, 150, 1, '{"icono": "file-text"}'::jsonb),
(NULL, 'servicio', 'Descarga Masiva de JSON', 'Descarga automática de JSONs del Ministerio', 'SRV_JSON', 120, 12, 0, 2, '{"icono": "download"}'::jsonb),
(NULL, 'servicio', 'Sucursal Adicional', 'Configuración de sucursal adicional', 'SRV_SUCURSAL', 300, 30, 100, 3, '{"icono": "map-pin", "por_unidad": true}'::jsonb),
(NULL, 'servicio', 'Banner Publicitario en Correo', 'Banner promocional en emails de DTEs', 'SRV_BANNER', 60, 6, 0, 4, '{"icono": "mail"}'::jsonb);

-- SERVICIOS CON PRECIO POR DTE
INSERT INTO pricing_items (company_id, tipo, nombre, descripcion, codigo, precio_por_dte, orden, metadata) VALUES
(NULL, 'servicio', 'Envío Masivo por WhatsApp', 'Envío automático de DTEs por WhatsApp', 'SRV_WHATSAPP', 0.025, 5, '{"icono": "message-circle", "calculo": "por_dte"}'::jsonb);

-- IMPLEMENTACIÓN (Costo único)
INSERT INTO pricing_items (company_id, tipo, nombre, descripcion, codigo, costo_unico, predeterminado, orden) VALUES
(NULL, 'implementacion', 'Costo de Implementación', 'Configuración inicial del sistema', 'IMP_INICIAL', 50, true, 1);

COMMENT ON TABLE pricing_items IS 'Catálogo configurable de productos y servicios para cotizaciones';
