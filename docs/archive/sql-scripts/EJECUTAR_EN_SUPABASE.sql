-- ============================================================
-- ⚡ MIGRATION URGENTE - AGREGAR COLUMNAS FALTANTES
-- ============================================================
-- INSTRUCCIONES:
-- 1. Copia TODO este código
-- 2. Ve a: https://supabase.com/dashboard
-- 3. Selecciona tu proyecto
-- 4. Click en "SQL Editor" (barra lateral izquierda)
-- 5. Click en "New query"
-- 6. Pega este código
-- 7. Click en "RUN" o presiona Ctrl+Enter
-- ============================================================

-- Agregar columnas faltantes
ALTER TABLE cotizaciones 
ADD COLUMN IF NOT EXISTS subtotal_recurrente DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_recurrente DECIMAL(10,2) DEFAULT 0;

-- Actualizar registros existentes con valores calculados
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

-- Verificar que las columnas se crearon correctamente
SELECT 
    COUNT(*) as total_cotizaciones,
    COUNT(subtotal_recurrente) as con_subtotal,
    COUNT(iva_recurrente) as con_iva
FROM cotizaciones;

-- ============================================================
SELECT '✅ MIGRACIÓN COMPLETADA EXITOSAMENTE' as status;
-- ============================================================
