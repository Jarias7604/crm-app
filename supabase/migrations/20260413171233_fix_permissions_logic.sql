-- 1. Insert missing 'clientes.view' permission to definitions UI
INSERT INTO permission_definitions (permission_key, category, label, description, is_system_only)
VALUES 
    ('clientes.view', 'Clientes', 'Ver Clientes', 'Permite visualizar el módulo de clientes', false),
    ('clientes.edit', 'Clientes', 'Editar Clientes', 'Permite editar la cartera de clientes', false)
ON CONFLICT (permission_key) DO NOTHING;

-- 2. Fix bug where company license default overwrote role permissions for collaborators
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_role_id uuid;
    v_profile_role text;
    v_persisted_perms jsonb;
    v_company_id uuid;
    v_company_license jsonb;
    raw_perms jsonb := '{}'::jsonb;
    final_perms jsonb := '{}'::jsonb;
    k text;
    v boolean;
BEGIN
    SELECT permissions, role, custom_role_id, company_id
    INTO v_persisted_perms, v_profile_role, v_role_id, v_company_id
    FROM public.profiles
    WHERE id = user_id;

    IF v_profile_role = 'super_admin' THEN
        SELECT jsonb_object_agg(permission_key, true) INTO final_perms FROM public.permission_definitions;
        RETURN final_perms;
    END IF;

    SELECT allowed_permissions INTO v_company_license FROM public.companies WHERE id = v_company_id;

    -- 1. Initialize with role permissions
    IF v_role_id IS NOT NULL THEN
        SELECT COALESCE(jsonb_object_agg(rp.permission_key, rp.is_enabled), '{}'::jsonb)
        INTO raw_perms
        FROM public.role_permissions rp
        WHERE rp.role_id = v_role_id
          AND rp.is_enabled = true;
    END IF;

    -- 2. Apply user-specific overrides. 
    raw_perms := raw_perms || COALESCE(v_persisted_perms, '{}'::jsonb);

    -- 3. Intersect with company license for base modules
    -- Base modules are the ones in v_company_license.
    -- If they are company_admin, they get all licensed modules.
    -- If they are regular users, they only get what raw_perms gives them.
    FOR k IN SELECT jsonb_array_elements_text(v_company_license)
    LOOP
        IF v_profile_role = 'company_admin' THEN
            final_perms := final_perms || jsonb_build_object(k, true);
        ELSE
            IF COALESCE((raw_perms->>k)::boolean, false) = true THEN
                final_perms := final_perms || jsonb_build_object(k, true);
            END IF;
        END IF;
    END LOOP;

    -- 4. Include explicit sub-permissions (like leads_view, clientes.view, etc) from raw_perms
    -- We assume sub-permissions don't need strict license filtering if the company configured them,
    -- or we rely on the UI to only show valid ones.
    FOR k, v IN SELECT key, (value::text)::boolean FROM jsonb_each(raw_perms)
    LOOP
        IF v = true THEN
           final_perms := final_perms || jsonb_build_object(k, true);
        END IF;
    END LOOP;

    RETURN final_perms;
END;
$function$;
