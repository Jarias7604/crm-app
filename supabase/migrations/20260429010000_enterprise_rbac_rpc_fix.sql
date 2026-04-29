-- ============================================================
-- MIGRATION: Enterprise RBAC - get_user_permissions fix
-- DATE: 2026-04-29
-- DESCRIPTION: El RPC ahora usa custom_role como fuente única
--   de verdad (SSOT). Si el usuario tiene un custom_role_id
--   asignado, los permisos del perfil se ignoran completamente.
--   Resuelve el problema crónico de Patricia y otros admins
--   que perdían acceso a módulos al editar su perfil.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_permissions(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_id uuid;
    v_profile_role text;
    v_company_id uuid;
    v_role_permissions jsonb;
    v_profile_permissions jsonb;
BEGIN
    -- 1. Obtener datos del perfil
    SELECT role, custom_role_id, company_id, permissions
    INTO v_profile_role, v_role_id, v_company_id, v_profile_permissions
    FROM public.profiles
    WHERE id = user_id;

    -- 2. Super Admin: acceso total a todos los módulos
    IF v_profile_role = 'super_admin' THEN
        SELECT jsonb_object_agg(permission_key, true)
        INTO v_role_permissions
        FROM public.permission_definitions;
        RETURN COALESCE(v_role_permissions, '{}'::jsonb);
    END IF;

    -- 3. ENTERPRISE RBAC: Si tiene custom_role asignado,
    --    el ROL es la fuente única de verdad (SSOT).
    --    profiles.permissions se IGNORA completamente.
    IF v_role_id IS NOT NULL THEN
        SELECT permissions
        INTO v_role_permissions
        FROM public.custom_roles
        WHERE id = v_role_id;

        RETURN COALESCE(v_role_permissions, '{}'::jsonb);
    END IF;

    -- 4. Fallback: sin rol personalizado → usar permisos del perfil
    RETURN COALESCE(v_profile_permissions, '{}'::jsonb);
END;
$$;
