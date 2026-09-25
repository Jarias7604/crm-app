-- ============================================================
-- MIGRATION: Unified Permissions — Single Source of Truth (SSOT)
-- DATE: 2026-09-25
-- DESCRIPTION:
--   1. Backfills role_permissions from custom_roles.permissions JSONB
--      for ALL existing company roles (idempotent — uses ON CONFLICT DO NOTHING).
--   2. Replaces get_user_permissions with a fully deterministic version:
--      no cascading fallbacks, no stale JSONB reads.
--   3. Adds trigger to auto-initialize role_permissions rows when a
--      new custom_role is created, so the admin always sees a full matrix.
--   4. Removes reliance on profiles.permissions and custom_roles.permissions
--      as active permission sources.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Backfill role_permissions from custom_roles.permissions
--         This ensures every existing role has rows in role_permissions.
--         ON CONFLICT DO NOTHING = safe to re-run, never overwrites admin config.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_key, is_enabled, updated_at)
SELECT
    cr.id                                          AS role_id,
    pd.permission_key,
    COALESCE(
        (cr.permissions ->> pd.permission_key)::boolean,
        false
    )                                              AS is_enabled,
    NOW()                                          AS updated_at
FROM public.custom_roles cr
CROSS JOIN public.permission_definitions pd
WHERE cr.company_id IS NOT NULL  -- Only company-scoped roles, not system null-company entries
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Also backfill system roles (company_id = 00000000-0000-0000-0000-000000000000)
INSERT INTO public.role_permissions (role_id, permission_key, is_enabled, updated_at)
SELECT
    cr.id                                          AS role_id,
    pd.permission_key,
    COALESCE(
        (cr.permissions ->> pd.permission_key)::boolean,
        false
    )                                              AS is_enabled,
    NOW()                                          AS updated_at
FROM public.custom_roles cr
CROSS JOIN public.permission_definitions pd
WHERE cr.company_id = '00000000-0000-0000-0000-000000000000'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Auto-sync trigger — when a new custom_role is created,
--         pre-populate role_permissions with all catalog permissions set to false.
--         This guarantees admin always sees a complete matrix.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_init_role_permissions_on_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.role_permissions (role_id, permission_key, is_enabled, updated_at)
    SELECT
        NEW.id,
        pd.permission_key,
        -- Inherit from JSONB if provided, else default to false
        COALESCE((NEW.permissions ->> pd.permission_key)::boolean, false),
        NOW()
    FROM public.permission_definitions pd
    ON CONFLICT (role_id, permission_key) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Drop and recreate trigger idempotently
DROP TRIGGER IF EXISTS trg_init_role_permissions ON public.custom_roles;

CREATE TRIGGER trg_init_role_permissions
    AFTER INSERT ON public.custom_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_init_role_permissions_on_create();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Deterministic get_user_permissions RPC (Single Source of Truth)
--
--   Priority order (clean, no cascades):
--     1. super_admin  → full catalog access (all true)
--     2. Has custom_role_id → read ONLY from role_permissions (SSOT)
--     3. company_admin (no custom_role_id) → derive from company's allowed_permissions
--     4. Everyone else → empty object {} (no access until admin configures)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_id     uuid;
    v_base_role   text;
    v_company_id  uuid;
    v_result      jsonb;
BEGIN
    -- Fetch profile fields in one query
    SELECT role, custom_role_id, company_id
    INTO v_base_role, v_role_id, v_company_id
    FROM public.profiles
    WHERE id = user_id;

    -- 1. Super Admin → full catalog access, always
    IF v_base_role = 'super_admin' THEN
        SELECT jsonb_object_agg(permission_key, true)
        INTO v_result
        FROM public.permission_definitions;
        RETURN COALESCE(v_result, '{}'::jsonb);
    END IF;

    -- 2. Custom role assigned → role_permissions is the ONLY source of truth
    IF v_role_id IS NOT NULL THEN
        SELECT jsonb_object_agg(permission_key, true)
        INTO v_result
        FROM public.role_permissions
        WHERE role_id = v_role_id
          AND is_enabled = true;
        RETURN COALESCE(v_result, '{}'::jsonb);
    END IF;

    -- 3. company_admin without custom_role → grant all licensed modules
    IF v_base_role = 'company_admin' AND v_company_id IS NOT NULL THEN
        SELECT jsonb_object_agg(elem, true)
        INTO v_result
        FROM public.companies c,
             jsonb_array_elements_text(c.allowed_permissions) AS elem
        WHERE c.id = v_company_id;
        -- Always add infra permissions for company_admin
        v_result := COALESCE(v_result, '{}'::jsonb)
            || '{"team_manage":true,"team_view_assigned":true,"branding":true,"dashboard_full":true}'::jsonb;
        RETURN v_result;
    END IF;

    -- 4. Everyone else → no permissions (must be configured by admin)
    RETURN '{}'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Sync the custom_roles.permissions JSONB column from role_permissions
--         for all existing roles (keeps backward compatibility with old code
--         that might still read the JSONB column during transition).
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.custom_roles cr
SET permissions = (
    SELECT COALESCE(jsonb_object_agg(rp.permission_key, rp.is_enabled), '{}'::jsonb)
    FROM public.role_permissions rp
    WHERE rp.role_id = cr.id
)
WHERE cr.id IN (
    SELECT DISTINCT role_id FROM public.role_permissions
);
