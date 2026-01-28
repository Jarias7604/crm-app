-- =====================================================
-- AGREGAR COLUMNAS FALTANTES A COTIZACIONES
-- =====================================================
-- Agrega subtotal_recurrente e iva_recurrente para el nuevo diseño de PDF

-- Agregar columnas si no existen
ALTER TABLE cotizaciones 
ADD COLUMN IF NOT EXISTS subtotal_recurrente DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_recurrente DECIMAL(10,2) DEFAULT 0;

-- Actualizar cotizaciones existentes calculando los valores
-- Solo actualiza donde estos campos son 0 o NULL
UPDATE cotizaciones
SET 
    subtotal_recurrente = CASE 
        WHEN total_anual > 0 AND (subtotal_recurrente IS NULL OR subtotal_recurrente = 0) THEN
            (total_anual - COALESCE(monto_anticipo, 0)) / (1 + (COALESCE(iva_porcentaje, 13) / 100.0))
        ELSE subtotal_recurrente
    END,
    iva_recurrente = CASE 
        WHEN total_anual > 0 AND (iva_recurrente IS NULL OR iva_recurrente = 0) THEN
            (total_anual - COALESCE(monto_anticipo, 0)) - 
            ((total_anual - COALESCE(monto_anticipo, 0)) / (1 + (COALESCE(iva_porcentaje, 13) / 100.0)))
        ELSE iva_recurrente
    END
WHERE total_anual > 0;

-- Comentario en las columnas para documentación
COMMENT ON COLUMN cotizaciones.subtotal_recurrente IS 'Subtotal de pagos recurrentes (sin IVA)';
COMMENT ON COLUMN cotizaciones.iva_recurrente IS 'IVA sobre los pagos recurrentes';
