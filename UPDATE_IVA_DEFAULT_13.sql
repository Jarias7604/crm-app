-- Migración para actualizar el valor por defecto del IVA a 13%
ALTER TABLE cotizaciones 
ALTER COLUMN iva_porcentaje SET DEFAULT 13;

-- Comentario informativo
COMMENT ON COLUMN cotizaciones.iva_porcentaje IS 'Porcentaje de IVA aplicado a la cotización (Default 13%)';
