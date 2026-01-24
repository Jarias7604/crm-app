-- =====================================================
-- SISTEMA DE COTIZADOR COMPLETO
-- Basado en Excel del cliente
-- =====================================================

-- TABLA 1: PAQUETES (con rangos de DTEs)
CREATE TABLE IF NOT EXISTS cotizador_paquetes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    
    -- Identificación
    paquete TEXT NOT NULL, -- 'BASIC', 'STARTER', 'PRO', etc.
    cantidad_dtes INTEGER NOT NULL,
    
    -- Costos
    costo_implementacion DECIMAL(10,2) DEFAULT 0,
    costo_paquete_anual DECIMAL(10,2) NOT NULL,
    costo_paquete_mensual DECIMAL(10,2) NOT NULL,
    
    -- Control
    activo BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    
    -- Metadata
    descripcion TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, paquete, cantidad_dtes)
);

-- TABLA 2: ITEMS DETALLADOS (Módulos y Servicios)
CREATE TABLE IF NOT EXISTS cotizador_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    
    -- Identificación
    tipo TEXT NOT NULL CHECK (tipo IN ('modulo', 'servicio', 'otro')),
    nombre TEXT NOT NULL,
    codigo TEXT,
    
    -- Precios
    pago_unico DECIMAL(10,2) DEFAULT 0,
    precio_anual DECIMAL(10,2) DEFAULT 0,
    precio_mensual DECIMAL(10,2) DEFAULT 0,
    precio_por_dte DECIMAL(10,4) DEFAULT 0, -- Para servicios como WhatsApp
    
    -- Control
    incluye_en_paquete BOOLEAN DEFAULT false, -- Si viene incluido en el paquete base
    activo BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    
    -- Metadata
    descripcion TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMENTARIOS
COMMENT ON TABLE cotizador_paquetes IS 'Paquetes base con rangos de DTEs (BASIC, STARTER, etc.)';
COMMENT ON TABLE cotizador_items IS 'Items individuales: módulos y servicios adicionales';

COMMENT ON COLUMN cotizador_paquetes.cantidad_dtes IS 'Cantidad de DTEs para este precio';
COMMENT ON COLUMN cotizador_items.precio_por_dte IS 'Precio variable según cantidad de DTEs';
COMMENT ON COLUMN cotizador_items.incluye_en_paquete IS 'Si el item viene incluido en el paquete base';

-- =====================================================
-- DATOS INICIALES (SEED DATA)
-- Basado en el Excel del cliente
-- =====================================================

-- PAQUETES BASIC (200-500 DTEs)
INSERT INTO cotizador_paquetes (company_id, paquete, cantidad_dtes, costo_implementacion, costo_paquete_anual, costo_paquete_mensual) VALUES
(NULL, 'BASIC', 200, 50.00, 129.50, 12.95),
(NULL, 'BASIC', 300, 75.00, 139.50, 13.95),
(NULL, 'BASIC', 400, 75.00, 149.50, 14.95),
(NULL, 'BASIC', 500, 75.00, 159.50, 15.95);

-- PAQUETES BASIC PLUS (600-900 DTEs)
INSERT INTO cotizador_paquetes (company_id, paquete, cantidad_dtes, costo_implementacion, costo_paquete_anual, costo_paquete_mensual) VALUES
(NULL, 'BASIC PLUS', 600, 100.00, 195.00, 19.50),
(NULL, 'BASIC PLUS', 700, 100.00, 205.00, 20.50),
(NULL, 'BASIC PLUS', 800, 100.00, 215.00, 21.50),
(NULL, 'BASIC PLUS', 900, 100.00, 225.00, 22.50);

-- PAQUETES STARTER (1000-3000 DTEs)
INSERT INTO cotizador_paquetes (company_id, paquete, cantidad_dtes, costo_implementacion, costo_paquete_anual, costo_paquete_mensual) VALUES
(NULL, 'STARTER', 1000, 100.00, 235.00, 23.50),
(NULL, 'STARTER', 1200, 100.00, 245.00, 24.50),
(NULL, 'STARTER', 1400, 100.00, 255.00, 25.50),
(NULL, 'STARTER', 1600, 100.00, 265.00, 26.50),
(NULL, 'STARTER', 1800, 100.00, 275.00, 27.50),
(NULL, 'STARTER', 2000, 100.00, 285.00, 28.50),
(NULL, 'STARTER', 2200, 100.00, 295.00, 29.50),
(NULL, 'STARTER', 2400, 100.00, 305.00, 30.50),
(NULL, 'STARTER', 2600, 100.00, 315.00, 31.50),
(NULL, 'STARTER', 2800, 100.00, 325.00, 32.50),
(NULL, 'STARTER', 3000, 100.00, 335.00, 33.50);

-- PAQUETES ESSENTIAL (3200-6000 DTEs)
INSERT INTO cotizador_paquetes (company_id, paquete, cantidad_dtes, costo_implementacion, costo_paquete_anual, costo_paquete_mensual) VALUES
(NULL, 'ESSENTIAL', 3200, 150.00, 345.00, 34.50),
(NULL, 'ESSENTIAL', 3400, 150.00, 355.00, 35.50),
(NULL, 'ESSENTIAL', 3600, 150.00, 365.00, 36.50),
(NULL, 'ESSENTIAL', 3800, 150.00, 375.00, 37.50),
(NULL, 'ESSENTIAL', 4000, 150.00, 385.00, 38.50),
(NULL, 'ESSENTIAL', 4200, 150.00, 395.00, 39.50),
(NULL, 'ESSENTIAL', 4400, 150.00, 405.00, 40.50),
(NULL, 'ESSENTIAL', 4600, 150.00, 415.00, 41.50),
(NULL, 'ESSENTIAL', 4800, 150.00, 425.00, 42.50),
(NULL, 'ESSENTIAL', 5000, 150.00, 435.00, 43.50),
(NULL, 'ESSENTIAL', 5200, 150.00, 445.00, 44.50),
(NULL, 'ESSENTIAL', 5400, 150.00, 455.00, 45.50),
(NULL, 'ESSENTIAL', 5600, 150.00, 465.00, 46.50),
(NULL, 'ESSENTIAL', 5800, 150.00, 475.00, 47.50),
(NULL, 'ESSENTIAL', 6000, 150.00, 490.00, 49.00);

-- PAQUETE ILIMITADO
INSERT INTO cotizador_paquetes (company_id, paquete, cantidad_dtes, costo_implementacion, costo_paquete_anual, costo_paquete_mensual) VALUES
(NULL, 'ILIMITADO', 6001, 200.00, 600.00, 60.00);

-- =====================================================
-- MÓDULOS ADICIONALES
-- =====================================================

INSERT INTO cotizador_items (company_id, tipo, nombre, precio_anual, precio_mensual, orden) VALUES
(NULL, 'modulo', 'POS', 75.00, 7.50, 1),
(NULL, 'modulo', 'Cuentas por Cobrar', 60.00, 6.00, 2),
(NULL, 'modulo', 'Comisiones', 60.00, 6.00, 3),
(NULL, 'modulo', 'Compras', 60.00, 6.00, 4),
(NULL, 'modulo', 'Producción', 75.00, 7.50, 5);

-- =====================================================
-- OTROS SERVICIOS
-- =====================================================

INSERT INTO cotizador_items (company_id, tipo, nombre, pago_unico, orden) VALUES
(NULL, 'servicio', 'Personalización tickets', 25.00, 1),
(NULL, 'servicio', 'Descarga masiva de JSON', 40.00, 2),
(NULL, 'servicio', 'Sucursal adicional', 75.00, 3),
(NULL, 'servicio', 'Banner publicitario en correo electrónico', 60.00, 4);

-- Servicio especial: WhatsApp (precio por DTE)
INSERT INTO cotizador_items (company_id, tipo, nombre, precio_por_dte, descripcion, orden) VALUES
(NULL, 'servicio', 'Envío masivo por WhatsApp', 0.03, 'Costo por cantidad de documentos contratados', 5);

-- =====================================================
-- ÍNDICES para rendimiento
-- =====================================================

CREATE INDEX idx_paquetes_company ON cotizador_paquetes(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_paquetes_activo ON cotizador_paquetes(activo) WHERE activo = true;
CREATE INDEX idx_paquetes_busqueda ON cotizador_paquetes(paquete, cantidad_dtes);

CREATE INDEX idx_items_company ON cotizador_items(company_id) WHERE company_id IS NULL;
CREATE INDEX idx_items_tipo ON cotizador_items(tipo) WHERE activo = true;
CREATE INDEX idx_items_activo ON cotizador_items(activo) WHERE activo = true;

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

ALTER TABLE cotizador_paquetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizador_items ENABLE ROW LEVEL SECURITY;

-- Super Admins: acceso total
CREATE POLICY "Super admins: full access to packages"
    ON cotizador_paquetes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins: full access to items"
    ON cotizador_items
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- Company users: ver globales + propios
CREATE POLICY "Company users: view packages"
    ON cotizador_paquetes
    FOR SELECT
    TO authenticated
    USING (
        company_id IS NULL
        OR company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Company users: view items"
    ON cotizador_items
    FOR SELECT
    TO authenticated
    USING (
        company_id IS NULL
        OR company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Company Admins: gestionar propios
CREATE POLICY "Company admins: manage packages"
    ON cotizador_paquetes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'company_admin'
            AND profiles.company_id = cotizador_paquetes.company_id
        )
    );

CREATE POLICY "Company admins: manage items"
    ON cotizador_items
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'company_admin'
            AND profiles.company_id = cotizador_items.company_id
        )
    );

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función para buscar paquete según DTEs
CREATE OR REPLACE FUNCTION buscar_paquete_por_dtes(
    p_cantidad_dtes INTEGER,
    p_company_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    paquete TEXT,
    cantidad_dtes INTEGER,
    costo_implementacion DECIMAL,
    costo_paquete_anual DECIMAL,
    costo_paquete_mensual DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.id,
        cp.paquete,
        cp.cantidad_dtes,
        cp.costo_implementacion,
        cp.costo_paquete_anual,
        cp.costo_paquete_mensual
    FROM cotizador_paquetes cp
    WHERE cp.activo = true
    AND (cp.company_id IS NULL OR cp.company_id = p_company_id)
    AND cp.cantidad_dtes >= p_cantidad_dtes
    ORDER BY cp.cantidad_dtes ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar datos
SELECT 
    paquete,
    COUNT(*) as total_rangos,
    MIN(cantidad_dtes) as min_dtes,
    MAX(cantidad_dtes) as max_dtes
FROM cotizador_paquetes
GROUP BY paquete
ORDER BY min_dtes;

SELECT tipo, COUNT(*) as total
FROM cotizador_items
GROUP BY tipo;
