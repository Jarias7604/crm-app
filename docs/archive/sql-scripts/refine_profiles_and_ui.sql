-- Add full_name column to profiles if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'full_name') THEN
        ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
    END IF;
END $$;

-- Update handle_new_user function to capture full_name from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
    v_role TEXT;
    v_invitation RECORD;
    v_full_name TEXT;
BEGIN
    -- Extract full_name from raw_user_meta_data
    v_full_name := new.raw_user_meta_data->>'full_name';

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
        INSERT INTO public.profiles (id, email, role, company_id, status, full_name)
        VALUES (
            new.id, 
            new.email, 
            v_role, 
            v_company_id, 
            'active',
            v_full_name
        );
        
    ELSE
        -- SCENARIO B: No invitation. Create new company (Self Signup).
        INSERT INTO public.companies (name, status, license_status)
        VALUES (
            COALESCE(new.raw_user_meta_data->>'company_name', 'Mi Empresa'),
            'active',
            'active'
        )
        RETURNING id INTO v_company_id;
        
        -- Create Profile linked to NEW company as Admin
        INSERT INTO public.profiles (id, email, role, company_id, status, full_name)
        VALUES (
            new.id, 
            new.email, 
            'company_admin', 
            v_company_id, 
            'active',
            v_full_name
        );
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
