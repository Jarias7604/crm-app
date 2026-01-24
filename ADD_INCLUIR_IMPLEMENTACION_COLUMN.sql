-- Add incluir_implementacion column to cotizaciones table
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS incluir_implementacion BOOLEAN DEFAULT TRUE;

-- Update existing records to true
UPDATE cotizaciones SET incluir_implementacion = TRUE WHERE incluir_implementacion IS NULL;
