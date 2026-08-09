-- ================================================================
-- MIGRATION: Fix admin_create_user parameter signature (new_birth_date)
-- FECHA: 2026-07-27
-- CAUSA: En migración 20260621122000 el parámetro new_birth_date fue 
--        escrito por error como new_address_date, lo cual causaba el error 
--        PostgREST RPC: "Could not find the function public.admin_create_user... in schema cache"
-- ================================================================

-- 1. Drop existing function variant with signature (text, text, text, text, uuid, text, uuid, date, text)
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, text, uuid, text, uuid, date, text);

-- 2. Create RPC with correct parameter name (new_birth_date)
CREATE OR REPLACE FUNCTION public.admin_create_user(
  new_email           text,
  new_password        text,
  new_full_name       text,
  new_role            text,
  new_company_id      uuid,
  new_phone           text         DEFAULT NULL,
  new_custom_role_id  uuid         DEFAULT NULL,
  new_birth_date      date         DEFAULT NULL,
  new_address         text         DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_new_user_id      uuid;
  v_effective_company uuid;
  v_caller_role      text;
  v_caller_is_platform_owner boolean;
BEGIN
  -- Security: get caller's company, role, and platform owner status from profiles (not JWT)
  SELECT role, company_id, is_platform_owner
  INTO v_caller_role, v_effective_company, v_caller_is_platform_owner
  FROM public.profiles
  WHERE id = auth.uid();

  -- Validate permissions
  IF v_caller_role NOT IN ('super_admin', 'company_admin') AND NOT COALESCE(v_caller_is_platform_owner, false) THEN
    RAISE EXCEPTION 'Access Denied: Only company_admin, super_admin, or platform_owner can create users';
  END IF;

  -- If platform_owner or super_admin, they can create users in any company
  IF COALESCE(v_caller_is_platform_owner, false) OR v_caller_role = 'super_admin' THEN
    -- super_admin/platform_owner must specify a company
    IF new_company_id IS NULL THEN
      RAISE EXCEPTION 'Company ID is required for super_admin to create users';
    END IF;
    v_effective_company := new_company_id;
  ELSE
    -- If company_admin, they can only create users in their own company
    IF new_company_id IS NOT NULL AND new_company_id <> v_effective_company THEN
      RAISE EXCEPTION 'Access Denied: company_admin cannot create users in other companies';
    END IF;
    -- Always use their own company_id
    v_effective_company := v_effective_company;
  END IF;

  -- Verify the company exists
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = v_effective_company) THEN
    RAISE EXCEPTION 'Company % does not exist', v_effective_company;
  END IF;

  v_new_user_id := gen_random_uuid();

  -- Insert into auth.users — NO confirmed_at (generated column in modern Supabase)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    role,
    aud,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token
  ) VALUES (
    v_new_user_id,
    '00000000-0000-0000-0000-000000000000',
    new_email,
    extensions.crypt(new_password, extensions.gen_salt('bf')),
    now(),            -- email_confirmed_at → user is pre-confirmed
    'authenticated',
    'authenticated',
    now(),
    now(),
    false,
    false,
    jsonb_build_object(
      'provider',    'email',
      'providers',   ARRAY['email'],
      'company_id',  v_effective_company,
      'role',        new_role
    ),
    jsonb_build_object('full_name', new_full_name),
    '', '', '', '', '', '', '', ''
  );

  -- Insert identity record so GoTrue can authenticate the user correctly
  INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_new_user_id,
    v_new_user_id::text,
    v_new_user_id,
    jsonb_build_object(
      'sub',            v_new_user_id::text,
      'email',          new_email,
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- Insert profile with correct company_id
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    company_id,
    phone,
    custom_role_id,
    birth_date,
    address,
    is_active,
    status,
    created_at
  ) VALUES (
    v_new_user_id,
    new_email,
    new_full_name,
    new_role::app_role,         -- cast text → enum
    v_effective_company,
    new_phone,
    new_custom_role_id,
    new_birth_date,
    new_address,
    true,
    'active',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name       = new_full_name,
    role            = new_role::app_role,   -- cast text → enum
    company_id      = v_effective_company,
    phone           = new_phone,
    custom_role_id  = new_custom_role_id,
    birth_date      = new_birth_date,
    address         = new_address,
    is_active       = true,
    status          = 'active';

  RETURN jsonb_build_object(
    'id',         v_new_user_id,
    'email',      new_email,
    'full_name',  new_full_name,
    'role',       new_role,
    'company_id', v_effective_company
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Email % already exists in the system', new_email;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating user: %', SQLERRM;
END;
$$;

-- Permisos admin_create_user
REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, uuid, text, uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, uuid, text, uuid, date, text) TO authenticated;
