-- ============================================================
-- MIGRATION: Fix RLS Infinite Recursion on Profiles and Companies
-- DATE: 2026-06-08
-- DESCRIPTION: Resolves circular references between profiles and companies
--   RLS policies by using a SECURITY DEFINER function to verify
--   platform ownership without triggering RLS recursively.
-- ============================================================

-- 1. Create a security definer helper function to break circular RLS recursion
CREATE OR REPLACE FUNCTION public.check_is_platform_owner(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_platform_owner boolean;
BEGIN
  SELECT COALESCE(is_platform_owner, false)
  INTO v_is_platform_owner
  FROM public.profiles
  WHERE id = user_id;
  
  RETURN v_is_platform_owner;
END;
$$;

-- Grant execute access to authenticated users
GRANT EXECUTE ON FUNCTION public.check_is_platform_owner(uuid) TO authenticated;

-- 2. Dynamically apply RLS policies based on table existence to prevent migration failures
DO $$
BEGIN
  -- Companies Policy
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    DROP POLICY IF EXISTS companies_platform_owner ON public.companies;
    CREATE POLICY companies_platform_owner ON public.companies
      FOR SELECT
      TO authenticated
      USING (
        public.check_is_platform_owner(auth.uid())
      );
  END IF;

  -- Leads Policy
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    DROP POLICY IF EXISTS leads_platform_owner ON public.leads;
    CREATE POLICY leads_platform_owner ON public.leads
      FOR ALL
      TO authenticated
      USING (
        public.check_is_platform_owner(auth.uid())
      )
      WITH CHECK (
        public.check_is_platform_owner(auth.uid())
      );
  END IF;

  -- Marketing Campaigns Policy
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketing_campaigns') THEN
    DROP POLICY IF EXISTS marketing_campaigns_platform_owner ON public.marketing_campaigns;
    CREATE POLICY marketing_campaigns_platform_owner ON public.marketing_campaigns
      FOR ALL
      TO authenticated
      USING (
        public.check_is_platform_owner(auth.uid())
      )
      WITH CHECK (
        public.check_is_platform_owner(auth.uid())
      );
  END IF;

  -- Marketing Conversations Policy
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketing_conversations') THEN
    DROP POLICY IF EXISTS marketing_conversations_platform_owner ON public.marketing_conversations;
    CREATE POLICY marketing_conversations_platform_owner ON public.marketing_conversations
      FOR ALL
      TO authenticated
      USING (
        public.check_is_platform_owner(auth.uid())
      )
      WITH CHECK (
        public.check_is_platform_owner(auth.uid())
      );
  END IF;
END $$;
