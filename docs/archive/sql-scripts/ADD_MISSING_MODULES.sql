-- =====================================================
-- AGREGAR MÓDULOS Y SERVICIOS FALTANTES
-- Ejecuta esto DESPUÉS de CREATE_PRICING_CONFIG_TABLE.sql
-- =====================================================

-- Agregar módulos adicionales que faltaban
INSERT INTO pricing_items (company_id, tipo, nombre, descripcion, codigo, precio_anual, precio_mensual, orden, metadata) VALUES
(NULL, 'modulo', 'Ventas', 'Módulo completo de gestión de ventas', 'MOD_VENTAS', 360, 36, 9, '{"icono": "trending-up"}'::jsonb),
(NULL, 'modulo', 'Cuentas por Cobrar', 'Gestión de cuentas por cobrar y cartera', 'MOD_CXC', 300, 30, 10, '{"icono": "dollar-sign"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Actualizar descripción de Compras si ya existe
UPDATE pricing_items 
SET descripcion = 'Módulo completo de gestión de compras y proveedores'
WHERE codigo = 'MOD_COMPRAS';

-- Actualizar descripción de POS si ya existe
UPDATE pricing_items 
SET descripcion = 'Punto de Venta integrado con facturación'
WHERE codigo = 'MOD_POS';

-- Verificar todos los módulos
SELECT nombre, descripcion, precio_anual, precio_mensual 
FROM pricing_items 
WHERE tipo = 'modulo' 
ORDER BY orden;
