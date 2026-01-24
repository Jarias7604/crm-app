-- =====================================================
-- MEJORAR PRICING_ITEMS - Sistema 100% Dinámico
-- =====================================================

-- Agregar campos para precios base por DTE
ALTER TABLE pricing_items 
ADD COLUMN IF NOT EXISTS precio_base_dte DECIMAL(10,4) DEFAULT 0;

-- Agregar campo para fórmula de cálculo personalizada
ALTER TABLE pricing_items 
ADD COLUMN IF NOT EXISTS formula_calculo TEXT DEFAULT 'fijo';
-- Valores posibles: 'fijo', 'por_dte', 'por_cantidad', 'personalizado'

-- Agregar campo para margen de ganancia
ALTER TABLE pricing_items 
ADD COLUMN IF NOT EXISTS margen_ganancia DECIMAL(5,2) DEFAULT 0;

-- Agregar campo para visibilidad en wizard
ALTER TABLE pricing_items 
ADD COLUMN IF NOT EXISTS mostrar_en_wizard BOOLEAN DEFAULT true;

-- Agregar campo para orden en wizard
ALTER TABLE pricing_items 
ADD COLUMN IF NOT EXISTS grupo TEXT;
-- Valores: 'plan_basico', 'plan_premium', 'modulo_ventas', etc.

-- COMENTARIOS
COMMENT ON COLUMN pricing_items.precio_base_dte IS 'Precio base por cada DTE (para cálculos variables)';
COMMENT ON COLUMN pricing_items.formula_calculo IS 'Tipo de cálculo: fijo, por_dte, por_cantidad, personalizado';
COMMENT ON COLUMN pricing_items.margen_ganancia IS 'Margen de ganancia en porcentaje';
COMMENT ON COLUMN pricing_items.mostrar_en_wizard IS 'Si se muestra en el wizard de cotización';
COMMENT ON COLUMN pricing_items.grupo IS 'Agrupación para organizar en UI';

-- Actualizar planes existentes con fórmula
UPDATE pricing_items 
SET formula_calculo = 'fijo', 
    mostrar_en_wizard = true,
    grupo = 'planes_principales'
WHERE tipo = 'plan';

-- Actualizar módulos existentes
UPDATE pricing_items 
SET formula_calculo = 'fijo',
    mostrar_en_wizard = true,
    grupo = 'modulos_adicionales'
WHERE tipo = 'modulo';

-- Actualizar servicios con precio por DTE
UPDATE pricing_items 
SET formula_calculo = 'por_dte',
    precio_base_dte = precio_por_dte,
    mostrar_en_wizard = true,
    grupo = 'servicios_extra'
WHERE precio_por_dte > 0;

-- Verificar cambios
SELECT 
    tipo,
    nombre,
    precio_anual,
    precio_base_dte,
    formula_calculo,
    grupo,
    mostrar_en_wizard
FROM pricing_items
ORDER BY tipo, orden;
