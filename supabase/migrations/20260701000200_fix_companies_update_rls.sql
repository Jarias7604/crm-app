-- Fix companies_update RLS policy to allow super_admins and platform owners to modify companies
DROP POLICY IF EXISTS companies_update ON public.companies;

CREATE POLICY companies_update ON public.companies
  FOR UPDATE
  TO authenticated
  USING (
    id = public.get_auth_company_id() 
    OR parent_company_id = public.get_auth_company_id()
    OR public.get_auth_role() = 'super_admin'
    OR public.check_is_platform_owner(auth.uid())
  )
  WITH CHECK (
    id = public.get_auth_company_id() 
    OR parent_company_id = public.get_auth_company_id()
    OR public.get_auth_role() = 'super_admin'
    OR public.check_is_platform_owner(auth.uid())
  );
