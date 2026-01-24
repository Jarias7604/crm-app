-- =====================================================
-- LIMPIEZA: Eliminar políticas y triggers de pricing_items
-- Ejecuta esto ANTES de CREATE_PRICING_CONFIG_TABLE.sql
-- =====================================================

-- Eliminar políticas RLS existentes (si existen)
DROP POLICY IF EXISTS "Super admins have full access to all pricing items" ON pricing_items;
DROP POLICY IF EXISTS "Users can view pricing items" ON pricing_items;
DROP POLICY IF EXISTS "Company admins can manage pricing items" ON pricing_items;

-- Eliminar trigger existente (si existe)
DROP TRIGGER IF EXISTS trigger_update_pricing_items_updated_at ON pricing_items;

-- Eliminar función existente (si existe)
DROP FUNCTION IF EXISTS update_pricing_items_updated_at();

-- Opcional: Eliminar la tabla completa (DESCOMENTA si quieres empezar desde cero)
-- DROP TABLE IF EXISTS pricing_items CASCADE;

-- ✅ Ahora puedes ejecutar CREATE_PRICING_CONFIG_TABLE.sql sin errores
