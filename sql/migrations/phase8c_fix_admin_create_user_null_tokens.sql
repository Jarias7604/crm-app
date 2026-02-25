-- Phase 8c: Fix admin_create_user NULL token fields
--
-- Problem: GoTrue (Supabase auth) requires confirmation_token, recovery_token,
-- email_change_token_new, and reauthentication_token to be '' (empty string).
-- When NULL, login fails with:
-- "sql: Scan error on column index 3, name confirmation_token: converting NULL to string is unsupported"
-- This caused the "Database error querying schema" message on the login page.
--
-- Root cause: admin_create_user INSERT into auth.users didn't include these columns,
-- so they defaulted to NULL instead of ''.
--
-- Fix: Explicitly include all 5 token fields with '' values in the INSERT.
-- Also fixed Gerson Gutt's existing record directly via UPDATE.
-- Applied to: PROD, DEV (2026-02-25)

CREATE OR REPLACE FUNCTION public.admin_create_user(
    new_email text,
    new_password text,
    new_full_name text,
    new_role text,
    new_company_id uuid,
    new_phone text DEFAULT NULL,
    new_custom_role_id uuid DEFAULT NULL,
    new_birth_date date DEFAULT NULL,
    new_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    new_user_id uuid := gen_random_uuid();
BEGIN
    IF NOT (public.get_auth_role() IN ('super_admin', 'company_admin')) THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at,
        confirmation_token,       -- Must be '' not NULL (GoTrue Go string scan)
        recovery_token,           -- Must be '' not NULL
        email_change_token_new,   -- Must be '' not NULL
        email_change_token_current,
        reauthentication_token,   -- Must be '' not NULL
        email_change_confirm_status,
        raw_app_meta_data, raw_user_meta_data, 
        is_super_admin, is_sso_user,
        created_at, updated_at, confirmation_sent_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', 
        new_user_id, 'authenticated', 'authenticated', 
        new_email, crypt(new_password, gen_salt('bf')), 
        now(), '', '', '', '', '', 0,
        jsonb_build_object(
            'provider', 'email', 'providers', array['email'], 
            'role', new_role, 'company_id', new_company_id, 'skip_trigger', true
        ), 
        jsonb_build_object('full_name', new_full_name),
        false, false, now(), now(), now()
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), new_user_id, 
        jsonb_build_object('sub', new_user_id, 'email', new_email, 'email_verified', true),
        'email', new_user_id, now(), now(), now());

    INSERT INTO public.profiles (id, email, role, company_id, full_name, phone, is_active, custom_role_id, birth_date, address)
    VALUES (new_user_id, new_email, new_role::app_role, new_company_id, new_full_name, new_phone, true, new_custom_role_id, new_birth_date, new_address);

    RETURN new_user_id;
END;
$$;
