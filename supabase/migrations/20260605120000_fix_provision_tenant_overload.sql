-- ================================================================
-- FIX: Eliminar función duplicada provision_new_tenant
-- PROBLEMA: Hay 2 versiones con distintos tipos en p_allowed_permissions
--   v1 (vieja): p_allowed_permissions => jsonb  (migración anterior)
--   v2 (nueva): p_allowed_permissions => text[] (migración emergency fix)
-- PostgREST retorna error PGRST203 (ambigüedad de función)
-- SOLUCIÓN: Eliminar la versión jsonb, dejar solo text[]
-- DB: PRODUCCIÓN mtxqqamitglhehaktgxm
-- ================================================================

-- Eliminar la versión antigua (jsonb) que quedó huérfana
DROP FUNCTION IF EXISTS public.provision_new_tenant(
  text, text, text, text, text, text, int, jsonb, text, text, text
);

-- La versión correcta (text[]) fue creada por la migración emergency fix
-- y es la que usa adminService.provisionNewTenant() en admin.ts
-- No se toca: provision_new_tenant(text, text, text, text, text, text, int, text[], text, text, text)

-- Verificar que solo queda una versión
SELECT
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  p.oid
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'provision_new_tenant';
