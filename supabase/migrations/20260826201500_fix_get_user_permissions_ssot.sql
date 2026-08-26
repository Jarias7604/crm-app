-- ============================================================
-- MIGRATION: Fix get_user_permissions RPC to read role_permissions table
-- DATE: 2026-08-26
-- DESCRIPTION: Ensures get_user_permissions RPC aggregates enabled
--   permissions directly from public.role_permissions where is_enabled = true.
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
    v_role_permissions jsonb;
BEGIN
    -- 1. Obtener datos del perfil
    SELECT role, custom_role_id
    INTO v_profile_role, v_role_id
    FROM public.profiles
    WHERE id = user_id;

    -- 2. Super Admin: acceso total a todos los módulos
    IF v_profile_role = 'super_admin' THEN
        SELECT jsonb_object_agg(permission_key, true)
        INTO v_role_permissions
        FROM public.permission_definitions;
        RETURN COALESCE(v_role_permissions, '{}'::jsonb);
    END IF;

    -- 3. Si tiene custom_role asignado, leer directamente de role_permissions (donde is_enabled = true)
    IF v_role_id IS NOT NULL THEN
        SELECT jsonb_object_agg(permission_key, is_enabled)
        INTO v_role_permissions
        FROM public.role_permissions
        WHERE role_id = v_role_id AND is_enabled = true;

        -- Si existen registros activos en role_permissions, retornar ese mapa
        IF v_role_permissions IS NOT NULL THEN
            RETURN v_role_permissions;
        END IF;

        -- Fallback a custom_roles.permissions si no hay filas en role_permissions
        SELECT permissions
        INTO v_role_permissions
        FROM public.custom_roles
        WHERE id = v_role_id;

        RETURN COALESCE(v_role_permissions, '{}'::jsonb);
    END IF;

    RETURN '{}'::jsonb;
END;
$$;
