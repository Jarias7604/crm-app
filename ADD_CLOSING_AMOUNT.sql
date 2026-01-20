-- EJECUTAR EN SUPABASE SQL EDITOR
-- Agregar columna de Monto de Cierre

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS closing_amount numeric DEFAULT 0;

SELECT 'Columna closing_amount agregada!' as resultado;
