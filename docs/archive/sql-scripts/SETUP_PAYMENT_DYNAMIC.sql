-- ==========================================================
-- SCRIPT DE REINGENIERÍA DE PAGOS: MOTOR DINÁMICO
-- ==========================================================
-- Este script crea la infraestructura necesaria para gestionar 
-- formas de pago, intereses y planes de financiamiento de forma dinámica.

-- 1. Tabla de Parámetros Globales de Pago
CREATE TABLE IF NOT EXISTS payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    iva_defecto DECIMAL DEFAULT 13.0,
    descuento_pago_unico_defecto DECIMAL DEFAULT 20.0,
    recargo_financiamiento_base DECIMAL DEFAULT 20.0,
    nota_mejor_precio TEXT DEFAULT 'Mejor precio garantizado en pago único',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(company_id)
);

-- 2. Tabla de Planes de Financiamiento Dinámicos
CREATE TABLE IF NOT EXISTS financing_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    titulo VARCHAR(100) NOT NULL,
    meses INTEGER NOT NULL,
    interes_porcentaje DECIMAL NOT NULL,
    descripcion TEXT,
    es_popular BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Habilitar RLS
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE financing_plans ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acceso
DROP POLICY IF EXISTS "Public view payment settings" ON payment_settings;
CREATE POLICY "Public view payment settings" ON payment_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public view financing plans" ON financing_plans;
CREATE POLICY "Public view financing plans" ON financing_plans FOR SELECT USING (true);

-- 5. Datos Iniciales (Seed)
-- Settings globales
INSERT INTO payment_settings (company_id, iva_defecto, descuento_pago_unico_defecto, recargo_financiamiento_base, nota_mejor_precio)
VALUES (NULL, 13.0, 20.0, 20.0, 'Mejor precio garantizado en pago único')
ON CONFLICT (company_id) WHERE company_id IS NULL DO NOTHING;

-- Planes iniciales representados en las imágenes del cliente
INSERT INTO financing_plans (company_id, titulo, meses, interes_porcentaje, descripcion, es_popular, orden)
VALUES
(NULL, '1 Solo pago', 12, 0, 'Ahorra 20% eligiendo pago anual', false, 0),
(NULL, '3 Meses', 3, 15, 'Trimestral - Pago cada 3 meses', true, 1),
(NULL, '6 Meses', 6, 10, 'Semestral - Pago cada 6 meses', false, 2),
(NULL, '9 Meses', 9, 5, '3 trimestres - Pago cada 9 meses', false, 3),
(NULL, '12 Meses', 12, 0, 'Anual - Pago mensual sin recargo extra sobre base', false, 4)
ON CONFLICT DO NOTHING;
