-- SCRIPT MAESTRO DE REPARACIÓN (V4)
-- Propósito: Forzar a Supabase a reconocer la columna 'cuotas' y recargar la configuración.
-- Ejecutar TODAS las líneas a la vez.

BEGIN;

-- 1. Eliminar la columna si existe (para asegurar limpieza)
ALTER TABLE financing_plans DROP COLUMN IF EXISTS cuotas;

-- 2. Volver a crear la columna
ALTER TABLE financing_plans ADD COLUMN cuotas INTEGER DEFAULT NULL;

-- 3. Migrar datos antiguos (meses -> cuotas)
UPDATE financing_plans SET cuotas = meses WHERE cuotas IS NULL;

-- 4. Comentario para forzar actualización de metadatos
COMMENT ON COLUMN financing_plans.cuotas IS 'Cantidad de pagos (installments). Force Refresh.';

COMMIT;

-- 5. Recargar Configuración (Fuera del bloque transaccional si es posible, sino Supabase lo maneja)
NOTIFY pgrst, 'reload config';

-- 6. Verificación
SELECT id, titulo, meses, cuotas, tipo_ajuste FROM financing_plans LIMIT 5;
