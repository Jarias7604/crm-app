-- ==========================================
-- 🏢 SaaS CORE LOGIC & MULTI-TENANCY
-- ==========================================

-- 1. ENHANCE COMPANIES TABLE
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. LICENSE VALIDATION FUNCTIONS
DROP FUNCTION IF EXISTS public.get_company_user_count(UUID);
DROP FUNCTION IF EXISTS public.check_can_add_user(UUID);

-- Function to count active users in a company
CREATE OR REPLACE FUNCTION public.get_company_user_count(p_company_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*)::INTEGER FROM public.profiles WHERE company_id = p_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a company can add more users
CREATE OR REPLACE FUNCTION public.check_can_add_user(p_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_max INTEGER;
  v_current INTEGER;
BEGIN
  SELECT max_users INTO v_max FROM public.companies WHERE id = p_company_id;
  v_current := public.get_company_user_count(p_company_id);
  RETURN v_current < v_max;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. STRICT RLS ISOLATION (PRIVACY SaaS)
-- Only company members see their own leads. Super Admin is EXCLUDED for privacy.
DROP POLICY IF EXISTS "leads_read_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_all_v2" ON public.leads;
DROP POLICY IF EXISTS "Users can view own company leads" ON public.leads;
DROP POLICY IF EXISTS "saas_leads_isolation" ON public.leads;

CREATE POLICY "saas_leads_isolation" ON public.leads
    FOR ALL
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

-- Profiles: Members see their team. Super Admin sees EVERYONE for management.
DROP POLICY IF EXISTS "profiles_select_v2" ON public.profiles;
DROP POLICY IF EXISTS "safe_profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "saas_profiles_isolation" ON public.profiles;

CREATE POLICY "saas_profiles_isolation" ON public.profiles
    FOR SELECT
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR 
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- Companies: Members see their own. Super admin sees all.
DROP POLICY IF EXISTS "companies_read_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_select_v2" ON public.companies;
DROP POLICY IF EXISTS "saas_companies_isolation" ON public.companies;

CREATE POLICY "saas_companies_isolation" ON public.companies
    FOR SELECT
    USING (
        id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR 
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- Super admin only policy for updating company limits
DROP POLICY IF EXISTS "super_admin_manage_companies" ON public.companies;

CREATE POLICY "super_admin_manage_companies" ON public.companies
    FOR UPDATE
    USING ((SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'super_admin')
    WITH CHECK ((SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

-- 4. UPDATE SIGNUP TRIGGER FOR LICENSE CHECK
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
    v_role TEXT;
    v_invitation RECORD;
BEGIN
    -- Check for valid pending invitation
    SELECT * INTO v_invitation 
    FROM public.company_invitations 
    WHERE email = new.email 
    AND status = 'pending'
    LIMIT 1;

    IF v_invitation IS NOT NULL THEN
        -- Check license limit before allowing signup
        IF NOT public.check_can_add_user(v_invitation.company_id) THEN
            RAISE EXCEPTION 'La empresa ha alcanzado su límite de usuarios. Contacte con el administrador.';
        END IF;

        v_company_id := v_invitation.company_id;
        v_role := v_invitation.role;
        
        UPDATE public.company_invitations 
        SET status = 'accepted' 
        WHERE id = v_invitation.id;
        
        INSERT INTO public.profiles (id, email, role, company_id, status)
        VALUES (new.id, new.email, v_role::public.app_role, v_company_id, 'active');
        
    ELSE
        -- Standard signup: create new company
        INSERT INTO public.companies (name, status, max_users)
        VALUES (
            COALESCE(new.raw_user_meta_data->>'company_name', 'Mi Empresa'),
            'active',
            5 -- Default initial limit
        )
        RETURNING id INTO v_company_id;
        
        INSERT INTO public.profiles (id, email, role, company_id, status)
        VALUES (new.id, new.email, 'company_admin'::public.app_role, v_company_id, 'active');
    END IF;

    RETURN new;
EXCEPTION
    WHEN others THEN
        RAISE EXCEPTION 'Error en el registro: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
