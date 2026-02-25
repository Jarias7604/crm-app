-- Phase 8c: Fix admin_create_user - ALL GoTrue required string fields
--
-- Root cause: GoTrue (Supabase Auth) is written in Go. Go cannot scan NULL into a
-- string type. Every text field in auth.users that GoTrue reads must be '' (empty
-- string), not NULL. Our admin_create_user INSERT was omitting several of these
-- fields, causing them to default to NULL and making login fail with:
--
--   "sql: Scan error on column index N, name "X": converting NULL to string is unsupported"
--
-- Fields that MUST be '':
--   confirmation_token, recovery_token, email_change, email_change_token_new,
--   email_change_token_current, reauthentication_token, phone_change
--
-- Fix also applied directly to existing affected users via:
--   UPDATE auth.users SET <all fields> = COALESCE(<field>, '') WHERE email = 'ggutt@ariasdefense.com';
--
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
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        -- All string token fields MUST be '' (empty string), never NULL.
        -- GoTrue uses Go string type which cannot scan NULL.
        confirmation_token,
        recovery_token,
        email_change,
        email_change_token_new,
        email_change_token_current,
        reauthentication_token,
        phone_change,
        email_change_confirm_status,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        is_sso_user,
        created_at,
        updated_at,
        confirmation_sent_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_user_id,
        'authenticated',
        'authenticated',
        new_email,
        crypt(new_password, gen_salt('bf')),
        now(),
        '', '', '', '', '', '', '',  -- 7 string token fields
        0,
        jsonb_build_object(
            'provider',     'email',
            'providers',    array['email'],
            'role',         new_role,
            'company_id',   new_company_id,
            'skip_trigger', true
        ),
        jsonb_build_object('full_name', new_full_name),
        false,
        false,
        now(),
        now(),
        now()
    );

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        new_user_id,
        jsonb_build_object('sub', new_user_id, 'email', new_email, 'email_verified', true),
        'email',
        new_user_id,
        now(), now(), now()
    );

    INSERT INTO public.profiles (
        id, email, role, company_id, full_name, phone,
        is_active, custom_role_id, birth_date, address
    ) VALUES (
        new_user_id, new_email, new_role::app_role, new_company_id,
        new_full_name, new_phone, true, new_custom_role_id, new_birth_date, new_address
    );

    RETURN new_user_id;
END;
$$;
