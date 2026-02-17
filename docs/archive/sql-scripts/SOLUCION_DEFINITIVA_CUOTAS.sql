-- ==========================================================
-- 🚨 SOLUCIÓN DEFINITIVA: ERROR 'CUOTAS' COLUMN
-- ==========================================================
-- Este script agrega la columna faltante a la tabla 'cotizaciones'
-- y fuerza a Supabase a reconocer los cambios.

-- 1. Agregar columna a la tabla de COTIZACIONES (El error actual)
ALTER TABLE public.cotizaciones 
ADD COLUMN IF NOT EXISTS cuotas INTEGER DEFAULT NULL;

-- 2. Agregar columna a la tabla de FINANCING_PLANS (Por si acaso)
ALTER TABLE public.financing_plans 
ADD COLUMN IF NOT EXISTS cuotas INTEGER DEFAULT NULL;

-- 3. Sincronizar datos (Fallback si cuotas es nulo)
UPDATE public.cotizaciones 
SET cuotas = plazo_meses 
WHERE cuotas IS NULL;

-- 4. RECARGAR CACHÉ DE POSTGREST (Paso Crítico)
-- Esto hace que la API reconozca la nueva columna de inmediato
NOTIFY pgrst, 'reload schema';

-- 5. Verificación
SELECT '✅ COLUMNAS AGREGADAS Y CACHÉ REFRESCADA!' as resultado;
