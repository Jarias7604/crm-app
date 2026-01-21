-- Add new columns to profiles if they don't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name text; -- Should exist, but confirming

-- Enable pgcrypto for password hashing if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to create a user directly (Admin only)
CREATE OR REPLACE FUNCTION admin_create_user(
    new_email text,
    new_password text,
    new_role text,
    new_full_name text,
    new_company_id uuid, -- Passed from client or derived
    new_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- Run as database owner to access auth.users
AS $$
DECLARE
    new_user_id uuid;
    executing_user_role text;
    executing_user_company uuid;
BEGIN
    -- Check if executing user is an admin
    SELECT role, company_id INTO executing_user_role, executing_user_company
    FROM profiles
    WHERE id = auth.uid();

    IF executing_user_role NOT IN ('super_admin', 'company_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can create users';
    END IF;

    -- Ensure company match if company_admin
    IF executing_user_role = 'company_admin' AND executing_user_company != new_company_id THEN
         RAISE EXCEPTION 'Unauthorized: Cannot create user for another company';
    END IF;

    -- Create user in auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        new_email,
        crypt(new_password, gen_salt('bf')),
        now(),
        now(),
        now(),
        '',
        '',
        '{"provider":"email","providers":["email"]}',
        '{}',
        false
    ) RETURNING id INTO new_user_id;

    -- Create profile
    INSERT INTO public.profiles (id, email, role, company_id, full_name, phone, status, is_active)
    VALUES (
        new_user_id,
        new_email,
        new_role,
        new_company_id,
        new_full_name,
        new_phone,
        'active',
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        company_id = EXCLUDED.company_id,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        is_active = EXCLUDED.is_active;

    RETURN new_user_id;
END;
$$;

-- Function to toggle user active status
CREATE OR REPLACE FUNCTION toggle_user_status(user_id uuid, status boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check permissions (simple check)
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'company_admin')
        AND company_id = (SELECT company_id FROM profiles WHERE id = user_id)
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Update is_active
    UPDATE profiles 
    SET is_active = status 
    WHERE id = user_id;
    
    -- IMPORTANT: We should also ideally block them in auth.users, but Supabase doesn't easily support "banning" via SQL without modifying auth.users directly which we are doing anyway.
    -- Better practice: use RLS policies that check profiles.is_active
    -- We will assume app checks profiles.is_active
END;
$$;
