-- Script para asegurar que Super Admin tenga TODOS los permisos habilitados
-- Ejecutar este script en Supabase SQL Editor

-- 1. Obtener todas las definiciones de permisos y habilitar para super_admin
INSERT INTO role_permissions (role, permission_key, is_enabled)
SELECT 
    'super_admin'::text as role,
    permission_key,
    true as is_enabled
FROM permission_definitions
ON CONFLICT (role, permission_key) 
DO UPDATE SET 
    is_enabled = true,
    updated_at = NOW();

-- 2. Verificar que todos los permisos están habilitados para super_admin
-- Este query debe retornar 0 si todo está correcto
SELECT COUNT(*) as permisos_deshabilitados
FROM role_permissions
WHERE role = 'super_admin' AND is_enabled = false;

-- 3. Mostrar resumen de permisos por rol
SELECT 
    role,
    COUNT(*) as total_permisos,
    COUNT(*) FILTER (WHERE is_enabled = true) as permisos_habilitados,
    COUNT(*) FILTER (WHERE is_enabled = false) as permisos_deshabilitados
FROM role_permissions
GROUP BY role
ORDER BY role;
