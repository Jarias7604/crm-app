-- Allow platform owners to delete companies
DROP POLICY IF EXISTS companies_platform_owner_delete ON public.companies;
CREATE POLICY companies_platform_owner_delete ON public.companies
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_platform_owner = true
    )
  );
