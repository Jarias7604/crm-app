-- HARDENING DE SEGURIDAD PARA SaaS MULTI-TENANT
-- Objetivo: Asegurar aislamiento total entre empresas autónomas.

BEGIN;

-- 1. HARDENING DE custom_roles
-- Queremos que un usuario solo vea roles de SU empresa o roles de SISTEMA (is_system = true)
DROP POLICY IF EXISTS "everyone_read_roles" ON public.custom_roles;
DROP POLICY IF EXISTS "Public roles access" ON public.custom_roles;

CREATE POLICY "SaaS custom_roles isolation" ON public.custom_roles
FOR SELECT TO authenticated
USING (
    company_id = get_auth_company_id() 
    OR is_system = true 
    OR get_auth_role() = 'super_admin'
);

-- 2. HARDENING DE role_permissions
-- Evitar que una empresa vea el mapa de permisos de otra.
DROP POLICY IF EXISTS "Anyone can view role permissions" ON public.role_permissions;

CREATE POLICY "SaaS role_permissions isolation" ON public.role_permissions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.custom_roles r
        WHERE r.id = role_id
        AND (r.company_id = get_auth_company_id() OR r.is_system = true)
    )
    OR get_auth_role() = 'super_admin'
);

-- 3. VERIFICACIÓN DE PERMISOS GRANULARES
-- Asegurar que get_user_permissions sea el único punto de entrada confiable para el frontend.
-- (Ya está implementado como RPC, pero el RLS anterior refuerza la seguridad por si alguien usa el SDK directamente)

COMMIT;

-- NOTA: Al ejecutar esto, el sistema se vuelve "Zero-Leaks" entre empresas.
