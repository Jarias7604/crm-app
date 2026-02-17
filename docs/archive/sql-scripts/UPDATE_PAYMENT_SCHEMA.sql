
-- Add payment terms columns to cotizaciones table
ALTER TABLE cotizaciones 
ADD COLUMN IF NOT EXISTS tipo_pago text DEFAULT 'contado' CHECK (tipo_pago IN ('contado', 'credito')),
ADD COLUMN IF NOT EXISTS plazo_meses integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS monto_anticipo decimal DEFAULT 0,
ADD COLUMN IF NOT EXISTS descripcion_pago text; -- For custom notes like "Pago inicial de implementación"
