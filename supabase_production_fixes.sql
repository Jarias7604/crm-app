-- Production Fixes for Supabase
-- Run this script in the SQL Editor of your Production Supabase project

-- 1. Drop the dangerous leads marketplace policy (fixes the data leakage)
DROP POLICY IF EXISTS "leads_marketplace_policy" ON public.leads;

-- 2. Clean up Old/Overloaded functions that cause "Could not choose best candidate function" errors
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, app_role, text, text, uuid, uuid, date, text);

-- 3. Fix `admin_create_user` to include missing raw_app_meta_data so new users can log in
CREATE OR REPLACE FUNCTION public.admin_create_user(new_email text, new_password text, new_full_name text, new_role text, new_company_id uuid, new_phone text DEFAULT NULL::text, new_custom_role_id uuid DEFAULT NULL::uuid, new_birth_date date DEFAULT NULL::date, new_address text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    new_user_id uuid := gen_random_uuid();
BEGIN
    IF NOT (public.get_auth_role() IN ('super_admin', 'company_admin')) THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        confirmation_token, recovery_token, email_change, email_change_token_new,
        email_change_token_current, reauthentication_token, phone_change,
        email_change_confirm_status,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, is_sso_user,
        created_at, updated_at, confirmation_sent_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_user_id, 'authenticated', 'authenticated',
        new_email, crypt(new_password, gen_salt('bf')), now(),
        '', '', '', '', '', '', '',
        0,
        jsonb_build_object('provider', 'email', 'providers', array['email'],
            'role', new_role, 'company_id', new_company_id, 'skip_trigger', true),
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
$function$;

-- 4. Fix `provision_new_tenant` for the same raw_app_meta_data auth.users injection
CREATE OR REPLACE FUNCTION public.provision_new_tenant(p_company_name text, p_license_status text DEFAULT 'active'::text, p_rnc text DEFAULT NULL::text, p_telefono text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_direccion text DEFAULT NULL::text, p_max_users integer DEFAULT 5, p_allowed_permissions jsonb DEFAULT '[]'::jsonb, p_admin_email text DEFAULT NULL::text, p_admin_password text DEFAULT NULL::text, p_admin_full_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  new_company_id UUID;
  new_user_id UUID;
  result JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Solo super_admin puede crear empresas';
  END IF;

  INSERT INTO companies (name, license_status, rnc, telefono, email, direccion, max_users, allowed_permissions)
  VALUES (p_company_name, p_license_status, p_rnc, p_telefono, p_email, p_direccion, p_max_users, p_allowed_permissions)
  RETURNING id INTO new_company_id;

  result := jsonb_build_object('company_id', new_company_id);

  IF p_admin_email IS NOT NULL AND p_admin_password IS NOT NULL THEN
    INSERT INTO auth.users (
      id, email, encrypted_password, email_confirmed_at, role, aud,
      raw_user_meta_data, raw_app_meta_data, created_at, updated_at, instance_id,
      confirmation_token, recovery_token, email_change_token_new,
      phone_change_token, email_change_token_current, reauthentication_token,
      email_change, phone, phone_change
    )
    VALUES (
      gen_random_uuid(), p_admin_email, crypt(p_admin_password, gen_salt('bf')),
      now(), 'authenticated', 'authenticated',
      jsonb_build_object('full_name', COALESCE(p_admin_full_name, p_admin_email)),
      jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', 'company_admin', 'company_id', new_company_id),
      now(), now(), '00000000-0000-0000-0000-000000000000',
      '', '', '', '', '', '',
      '', '', ''
    )
    RETURNING id INTO new_user_id;

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), new_user_id, new_user_id::text, 'email',
      jsonb_build_object('sub', new_user_id::text, 'email', p_admin_email, 'email_verified', true, 'phone_verified', false),
      now(), now(), now()
    );

    INSERT INTO profiles (id, email, full_name, role, company_id, is_active)
    VALUES (new_user_id, p_admin_email, COALESCE(p_admin_full_name, p_admin_email), 'company_admin', new_company_id, true);

    result := result || jsonb_build_object('admin_user_id', new_user_id, 'admin_email', p_admin_email);
  END IF;

  RETURN result;
END;
$function$;
