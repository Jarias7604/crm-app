-- =====================================================
-- Script: Agregar Permisos de Forma de Pago y Recargo
-- Fecha: 2026-01-27
-- Descripción: Agrega permisos para gestionar forma de pago
--              (anual/mensual) y recargo mensual en cotizaciones
-- =====================================================

-- 1. Agregar nuevas definiciones de permisos
INSERT INTO permission_definitions (category, permission_key, label)
VALUES 
    ('Cotizaciones', 'cotizaciones.change_payment_method', 'Cambiar forma de pago (anual/mensual)'),
    ('Cotizaciones', 'cotizaciones.edit_monthly_surcharge', 'Editar recargo de pago mensual'),
    ('Cotizaciones', 'cotizaciones.view_advanced_config', 'Ver configuración avanzada de cotizaciones')
ON CONFLICT (permission_key) DO NOTHING;

-- =====================================================
-- 2. SUPER ADMIN - Todos los permisos habilitados
-- =====================================================
INSERT INTO role_permissions (role, permission_key, is_enabled)
VALUES 
    ('super_admin', 'cotizaciones.change_payment_method', true),
    ('super_admin', 'cotizaciones.edit_monthly_surcharge', true),
    ('super_admin', 'cotizaciones.view_advanced_config', true)
ON CONFLICT (role, permission_key) DO UPDATE SET is_enabled = true;

-- =====================================================
-- 3. COMPANY ADMIN - Todos los permisos habilitados
-- =====================================================
INSERT INTO role_permissions (role, permission_key, is_enabled)
VALUES 
    ('company_admin', 'cotizaciones.change_payment_method', true),
    ('company_admin', 'cotizaciones.edit_monthly_surcharge', true),
    ('company_admin', 'cotizaciones.view_advanced_config', true)
ON CONFLICT (role, permission_key) DO UPDATE SET is_enabled = true;

-- =====================================================
-- 4. SALES AGENT - Solo puede cambiar forma de pago
--                  NO puede editar recargo
--                  NO puede ver config avanzada
-- =====================================================
INSERT INTO role_permissions (role, permission_key, is_enabled)
VALUES 
    ('sales_agent', 'cotizaciones.change_payment_method', true),
    ('sales_agent', 'cotizaciones.edit_monthly_surcharge', false),
    ('sales_agent', 'cotizaciones.view_advanced_config', false)
ON CONFLICT (role, permission_key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;

-- =====================================================
-- Verificación: Listar todos los permisos de cotizaciones
-- =====================================================
-- SELECT 
--     pd.category,
--     pd.permission_key,
--     pd.label,
--     rp.role,
--     rp.is_enabled
-- FROM permission_definitions pd
-- LEFT JOIN role_permissions rp ON pd.permission_key = rp.permission_key
-- WHERE pd.category = 'Cotizaciones'
-- ORDER BY pd.permission_key, rp.role;
