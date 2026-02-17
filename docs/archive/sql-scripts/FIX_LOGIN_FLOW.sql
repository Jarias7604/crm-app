-- 1. FIX: admin_create_user
-- Add 'skip_trigger' to metadata AND all required auth fields to prevent scan errors
CREATE OR REPLACE FUNCTION public.admin_create_user(
    new_email text, 
    new_password text, 
    new_role text, 
    new_full_name text, 
    new_company_id uuid, 
    new_phone text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_user_id uuid := gen_random_uuid();
BEGIN
    -- Validar permisos del que ejecuta
    IF NOT (public.get_auth_role() IN ('super_admin', 'company_admin')) THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    -- 1. Insertar Usuario en Auth con TODOS los campos requeridos
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, email_change_token_current, email_change_confirm_status,
        raw_app_meta_data, raw_user_meta_data, 
        is_super_admin, is_sso_user,
        created_at, updated_at, confirmation_sent_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', 
        new_user_id, 
        'authenticated', 
        'authenticated', 
        new_email, 
        crypt(new_password, gen_salt('bf')), 
        now(),
        '',  -- email_change_token_current must be empty string, not NULL
        0,   -- email_change_confirm_status
        jsonb_build_object(
            'provider', 'email', 
            'providers', array['email'], 
            'role', new_role, 
            'company_id', new_company_id,
            'skip_trigger', true
        ), 
        jsonb_build_object('full_name', new_full_name),
        false,  -- is_super_admin
        false,  -- is_sso_user
        now(), 
        now(),
        now()   -- confirmation_sent_at
    );

    -- 2. Insertar Identidad
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), new_user_id, 
        jsonb_build_object('sub', new_user_id, 'email', new_email, 'email_verified', true),
        'email', new_user_id, now(), now(), now()
    );

    -- 3. Insertar Perfil Público
    INSERT INTO public.profiles (id, email, role, company_id, full_name, phone, is_active)
    VALUES (new_user_id, new_email, new_role::app_role, new_company_id, new_full_name, new_phone, true);

    RETURN new_user_id;
END;
$$;

-- 2. FIX: handle_new_user
-- Ensure auth.users metadata is updated with company_id/role for Self Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_role TEXT;
    v_invitation RECORD;
BEGIN
    -- Skip trigger if created by admin
    IF new.raw_app_meta_data->>'skip_trigger' = 'true' THEN
        RETURN new;
    END IF;

    -- Check for valid pending invitation
    SELECT * INTO v_invitation 
    FROM public.company_invitations 
    WHERE email = new.email 
    AND status = 'pending'
    LIMIT 1;

    IF v_invitation IS NOT NULL THEN
        -- SCENARIO A: User was invited.
        v_company_id := v_invitation.company_id;
        v_role := v_invitation.role::text;
        
        -- Mark invitation as accepted
        UPDATE public.company_invitations 
        SET status = 'accepted' 
        WHERE id = v_invitation.id;
        
        -- Create Profile
        INSERT INTO public.profiles (id, email, role, company_id, is_active)
        VALUES (
            new.id, 
            new.email, 
            v_role::app_role,
            v_company_id, 
            true
        );
        
    ELSE
        -- SCENARIO B: Self Signup.
        INSERT INTO public.companies (name)
        VALUES (
            COALESCE(new.raw_user_meta_data->>'company_name', 'Mi Empresa')
        )
        RETURNING id INTO v_company_id;
        
        v_role := 'company_admin';

        -- Create Profile
        INSERT INTO public.profiles (id, email, role, company_id, is_active)
        VALUES (
            new.id, 
            new.email, 
            'company_admin'::app_role,
            v_company_id, 
            true
        );
    END IF;

    -- IMPORTANT: Sync Metadata to Auth (so RLS works)
    UPDATE auth.users
    SET raw_app_meta_data = 
        COALESCE(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
            'company_id', v_company_id,
            'role', v_role
        )
    WHERE id = new.id;

    RETURN new;
END;
$$;

-- 3. REPAIR EXISTING USERS - Metadata Sync
-- Sync auth metadata from profiles for anyone who is broken
DO $$
DECLARE 
    r RECORD;
BEGIN
    FOR r IN 
        SELECT p.id, p.company_id, p.role
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.id
        WHERE (u.raw_app_meta_data->>'company_id') IS NULL 
           OR (u.raw_app_meta_data->>'company_id')::uuid IS DISTINCT FROM p.company_id
    LOOP
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object(
                'company_id', r.company_id,
                'role', r.role
            )
        WHERE id = r.id;
    END LOOP;
END;
$$;

-- 4. REPAIR EXISTING USERS - Missing Auth Fields
-- Fix all admin-created users that have missing required auth fields
UPDATE auth.users
SET 
    confirmation_sent_at = COALESCE(confirmation_sent_at, created_at),
    is_sso_user = COALESCE(is_sso_user, false),
    is_super_admin = COALESCE(is_super_admin, false),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
    -- CRITICAL: All token fields MUST be empty strings, not NULL (Auth scan error)
    email_change = COALESCE(email_change, ''),
    phone_change = COALESCE(phone_change, ''),
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    reauthentication_token = COALESCE(reauthentication_token, '')
WHERE confirmation_sent_at IS NULL 
   OR is_sso_user IS NULL 
   OR is_super_admin IS NULL
   OR email_change IS NULL
   OR phone_change IS NULL
   OR confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL;
