-- 🚀 HABILITAR EDICIÓN DE PERMISOS (Para Super Admin)

-- El error ocurre porque solo existían permisos de LECTURA (SELECT).
-- Este script habilita ESCRITURA (Insert, Update, Delete) solo para el Super Admin.

-- 1. TABLA: role_permissions (Donde se guardan los toggles activados/desactivados)
DROP POLICY IF EXISTS "permissions_manage" ON public.role_permissions;

CREATE POLICY "permissions_manage" ON public.role_permissions
FOR ALL TO authenticated
USING (public.get_auth_role() = 'super_admin')
WITH CHECK (public.get_auth_role() = 'super_admin');

-- 2. TABLA: permission_definitions (Donde se definen los nombres de permisos)
DROP POLICY IF EXISTS "definitions_manage" ON public.permission_definitions;

CREATE POLICY "definitions_manage" ON public.permission_definitions
FOR ALL TO authenticated
USING (public.get_auth_role() = 'super_admin')
WITH CHECK (public.get_auth_role() = 'super_admin');

SELECT '✅ ACTUALIZACIÓN ACTIVADA. El Super Admin ya puede guardar cambios en permisos.' as status;
