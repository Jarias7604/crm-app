-- Migración para añadir soporte de IVA a las cotizaciones
ALTER TABLE cotizaciones 
ADD COLUMN IF NOT EXISTS iva_porcentaje NUMERIC DEFAULT 19,
ADD COLUMN IF NOT EXISTS iva_monto NUMERIC DEFAULT 0;

-- Actualizar comentarios de columnas
COMMENT ON COLUMN cotizaciones.iva_porcentaje IS 'Porcentaje de IVA aplicado a la cotización';
COMMENT ON COLUMN cotizaciones.iva_monto IS 'Monto total de IVA calculado';
