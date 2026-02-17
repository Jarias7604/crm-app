-- SCRIPT DE REPARACIÓN DE CACHÉ DE ESQUEMA V3
-- Ejecutar TODO el contenido para arreglar el error: "Could not find the 'cuotas' column"

-- 1. Intentar agregar la columna nuevamente (por seguridad)
ALTER TABLE financing_plans 
ADD COLUMN IF NOT EXISTS cuotas INTEGER DEFAULT NULL;

-- 2. Asegurarse que los datos tengan sentido (cuotas = meses como fallback)
UPDATE financing_plans 
SET cuotas = meses 
WHERE cuotas IS NULL;

-- 3. FORZAR RECARGA DE LA CACHÉ DE API (El paso crítico)
NOTIFY pgrst, 'reload config';

-- 4. Verificar resultado (deberías ver la columna aquí)
SELECT * FROM financing_plans LIMIT 1;
