-- ==============================================================================
-- MIGRATION: Single Source of Truth for Custom Roles & Manager RLS
-- DATE: 2026-10-24
-- DESCRIPTION:
--   1. Fixes profiles where custom_role_id was assigned to a Collaborator/Sales role
--      but profiles.role remained 'company_admin', which erroneously granted full
--      admin RLS bypass across cotizaciones, calendar, and leads.
--   2. Updates public.is_company_manager() to respect custom_roles.base_role so
--      collaborators assigned to custom roles are never treated as managers.
--   3. Adds a trigger to automatically sync profiles.role with custom_roles.base_role.
-- ==============================================================================

-- 1. Update is_company_manager to check custom_role.base_role
CREATE OR REPLACE FUNCTION public.is_company_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.custom_roles cr ON cr.id = p.custom_role_id
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR (p.custom_role_id IS NOT NULL AND cr.base_role IN ('company_admin', 'super_admin'))
        OR (p.custom_role_id IS NULL AND p.role = 'company_admin')
      )
      AND p.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_manager() TO authenticated;

-- 2. Immediate data cleanup: Sync profiles.role for any user assigned to a collaborator role
UPDATE public.profiles p
SET role = (
  CASE 
    WHEN cr.base_role IN ('company_admin', 'super_admin') THEN cr.base_role::app_role
    WHEN cr.base_role = 'sales_agent' THEN 'sales_agent'::app_role
    ELSE 'collaborator'::app_role
  END
)
FROM public.custom_roles cr
WHERE p.custom_role_id = cr.id
  AND cr.base_role NOT IN ('company_admin', 'super_admin')
  AND p.role IN ('company_admin', 'super_admin');

-- 3. Trigger to keep profiles.role synchronized with custom_role.base_role automatically
CREATE OR REPLACE FUNCTION public.fn_sync_profile_role_on_custom_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_base_role text;
BEGIN
    IF NEW.custom_role_id IS NOT NULL THEN
        SELECT base_role INTO v_base_role
        FROM public.custom_roles
        WHERE id = NEW.custom_role_id;

        IF v_base_role IS NOT NULL THEN
            IF v_base_role IN ('company_admin', 'super_admin') THEN
                NEW.role := v_base_role::app_role;
            ELSIF v_base_role = 'sales_agent' THEN
                NEW.role := 'sales_agent'::app_role;
            ELSE
                NEW.role := 'collaborator'::app_role;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_role ON public.profiles;

CREATE TRIGGER trg_sync_profile_role
    BEFORE INSERT OR UPDATE OF custom_role_id ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_profile_role_on_custom_role();
