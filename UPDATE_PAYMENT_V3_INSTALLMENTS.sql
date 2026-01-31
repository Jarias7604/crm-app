-- AGREGAR COLUMNA DE CUOTAS (Installments)
-- Esto permite separar la duración del contrato (meses) de la cantidad de pagos (cuotas).

ALTER TABLE financing_plans 
ADD COLUMN IF NOT EXISTS cuotas INTEGER DEFAULT NULL;

-- Actualizar registros existentes para que cuotas = meses (comportamiento legacy)
UPDATE financing_plans 
SET cuotas = meses 
WHERE cuotas IS NULL;

-- Comentario para documentación
COMMENT ON COLUMN financing_plans.cuotas IS 'Cantidad de pagos en los que se divide el total. Si es NULL, se usa la columna meses.';
