-- Enable RLS on profiles if not already (safeguard)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Create Company Invitations Table
CREATE TABLE IF NOT EXISTS public.company_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'company_admin', 'sales_agent')),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view invitations for their own company
DROP POLICY IF EXISTS "Admins view company invitations" ON public.company_invitations;
CREATE POLICY "Admins view company invitations" ON public.company_invitations
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'company_admin')
        )
    );

-- Policy: Admins can create invitations for their own company
DROP POLICY IF EXISTS "Admins create company invitations" ON public.company_invitations;
CREATE POLICY "Admins create company invitations" ON public.company_invitations
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'company_admin')
        )
    );

-- Policy: Admins can delete invitations (revoke)
DROP POLICY IF EXISTS "Admins delete company invitations" ON public.company_invitations;
CREATE POLICY "Admins delete company invitations" ON public.company_invitations
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'company_admin')
        )
    );

-- 2. Enhanced User Signup Function
-- This handles both:
-- A) New users creating a new company (Standard Signup)
-- B) Invited users joining an existing company (Invitation Signup)

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
        -- SCENARIO A: User was invited. Join existing company.
        v_company_id := v_invitation.company_id;
        v_role := v_invitation.role;
        
        -- Mark invitation as accepted
        UPDATE public.company_invitations 
        SET status = 'accepted' 
        WHERE id = v_invitation.id;
        
        -- Create Profile linked to existing company
        INSERT INTO public.profiles (id, email, role, company_id, status)
        VALUES (
            new.id, 
            new.email, 
            v_role, -- Use invited role
            v_company_id, -- Use invited company
            'active'
        );
        
    ELSE
        -- SCENARIO B: No invitation. Create new company (Self Signup).
        -- Create a new company for this user
        INSERT INTO public.companies (name, status)
        VALUES (
            COALESCE(new.raw_user_meta_data->>'company_name', 'Mi Empresa'),
            'active' -- Default to active for now (or trial)
        )
        RETURNING id INTO v_company_id;
        
        -- Create Profile linked to NEW company as Admin
        INSERT INTO public.profiles (id, email, role, company_id, status)
        VALUES (
            new.id, 
            new.email, 
            'company_admin', -- Creator is always admin
            v_company_id, 
            'active'
        );
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger (safeguard to ensure it's active)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Helper to view Team Members
-- Simplify fetching profiles for the frontend
DROP POLICY IF EXISTS "View team members" ON public.profiles;
CREATE POLICY "View team members" ON public.profiles
    FOR SELECT
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

