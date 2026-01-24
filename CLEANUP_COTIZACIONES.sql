-- =====================================================
-- LIMPIEZA: Eliminar políticas y triggers existentes
-- Ejecuta esto ANTES de CREATE_COTIZACIONES_TABLE.sql
-- =====================================================

-- Eliminar políticas RLS existentes (si existen)
DROP POLICY IF EXISTS "Super admins have full access to all cotizaciones" ON cotizaciones;
DROP POLICY IF EXISTS "Users can view their company cotizaciones" ON cotizaciones;
DROP POLICY IF EXISTS "Company admins can insert cotizaciones" ON cotizaciones;
DROP POLICY IF EXISTS "Company admins can update their cotizaciones" ON cotizaciones;
DROP POLICY IF EXISTS "Company admins can delete their cotizaciones" ON cotizaciones;

-- Eliminar trigger existente (si existe)
DROP TRIGGER IF EXISTS trigger_update_cotizaciones_updated_at ON cotizaciones;

-- Eliminar función existente (si existe)
DROP FUNCTION IF EXISTS update_cotizaciones_updated_at();

-- Opcional: Eliminar la tabla completa (DESCOMENTA si quieres empezar desde cero)
-- DROP TABLE IF EXISTS cotizaciones CASCADE;

-- ✅ Ahora puedes ejecutar CREATE_COTIZACIONES_TABLE.sql sin errores
