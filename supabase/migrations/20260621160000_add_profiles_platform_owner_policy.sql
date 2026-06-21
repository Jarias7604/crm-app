-- Allow platform owners and super_admins to view/manage profiles of any company
DROP POLICY IF EXISTS profiles_platform_owner ON public.profiles;
CREATE POLICY profiles_platform_owner ON public.profiles
  FOR ALL
  TO authenticated
  USING (
    public.get_auth_role() = 'super_admin'
    OR public.check_is_platform_owner(auth.uid())
  )
  WITH CHECK (
    public.get_auth_role() = 'super_admin'
    OR public.check_is_platform_owner(auth.uid())
  );
