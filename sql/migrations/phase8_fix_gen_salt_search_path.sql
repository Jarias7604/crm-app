-- Phase 8: Fix gen_salt search_path
-- 
-- Problem: pgcrypto is installed in the 'extensions' schema, but functions
-- admin_create_user, admin_update_user, and provision_new_tenant call
-- gen_salt/crypt without a schema prefix, causing:
-- "ERROR: function gen_salt(unknown) does not exist"
--
-- Solution: Add 'extensions' to each function's search_path.
-- Applied to: PROD, DEV, and documented locally (2026-02-25)

ALTER FUNCTION public.admin_create_user SET search_path = public, extensions;
ALTER FUNCTION public.admin_update_user SET search_path = public, extensions;
ALTER FUNCTION public.provision_new_tenant SET search_path = public, extensions;
