-- Phase 8b: Fix audit_profile_changes trigger enum cast error
--
-- Problem: COALESCE(OLD.role, '?') fails because OLD.role is type `app_role` (enum).
-- PostgreSQL tries to implicitly cast '?' to the app_role enum and fails with:
-- "ERROR: invalid input value for enum app_role: '?'"
--
-- Solution: Explicitly cast role to text before COALESCE.
-- Also added SECURITY DEFINER + search_path for consistency and safety.
-- Applied to: PROD, DEV (2026-02-25)

CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role 
       OR OLD.is_active IS DISTINCT FROM NEW.is_active
       OR OLD.custom_role_id IS DISTINCT FROM NEW.custom_role_id
       OR OLD.permissions IS DISTINCT FROM NEW.permissions THEN
      PERFORM public.log_audit_event(
        CASE 
          WHEN OLD.role IS DISTINCT FROM NEW.role OR OLD.custom_role_id IS DISTINCT FROM NEW.custom_role_id THEN 'PERMISSION_CHANGE'
          WHEN OLD.is_active IS DISTINCT FROM NEW.is_active THEN 'STATUS_CHANGE'
          ELSE 'UPDATE'
        END,
        'profile', NEW.id::text,
        COALESCE(NEW.full_name, NEW.email, 'Sin nombre'),
        CASE 
          WHEN OLD.role IS DISTINCT FROM NEW.role THEN 'Rol cambiado: ' || COALESCE(OLD.role::text, '?') || ' → ' || COALESCE(NEW.role::text, '?')
          WHEN OLD.is_active IS DISTINCT FROM NEW.is_active THEN 'Estado: ' || CASE WHEN NEW.is_active THEN 'Activado' ELSE 'Desactivado' END
          WHEN OLD.permissions IS DISTINCT FROM NEW.permissions THEN 'Permisos actualizados'
          ELSE 'Perfil actualizado'
        END,
        jsonb_build_object('role', OLD.role::text, 'is_active', OLD.is_active, 'custom_role_id', OLD.custom_role_id),
        jsonb_build_object('role', NEW.role::text, 'is_active', NEW.is_active, 'custom_role_id', NEW.custom_role_id)
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
