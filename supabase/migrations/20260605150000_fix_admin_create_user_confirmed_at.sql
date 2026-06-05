-- ================================================================
-- FIX: admin_create_user — eliminar confirmed_at (columna generada en Supabase)
-- En versiones recientes de Supabase, confirmed_at es GENERATED ALWAYS
-- y no se puede insertar manualmente. Se elimina del INSERT.
-- DB: PRODUCCIÓN mtxqqamitglhehaktgxm
-- ================================================================

CREATE OR REPLACE FUNCTION public.admin_create_user(
  new_email           text,
  new_password        text,
  new_full_name       text,
  new_role            text,
  new_company_id      uuid,
  new_phone           text         DEFAULT NULL,
  new_custom_role_id  uuid         DEFAULT NULL,
  new_address_date    date         DEFAULT NULL,
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
BEGIN
  -- Security: get caller's company and role from profiles (not JWT)
  SELECT role, company_id
  INTO v_caller_role, v_effective_company
  FROM profiles
  WHERE id = auth.uid();

  -- Validate permissions
  IF v_caller_role NOT IN ('super_admin', 'company_admin') THEN
    RAISE EXCEPTION 'Access Denied: Only company_admin or super_admin can create users';
  END IF;

  -- If company_admin, they can only create users in their own company
  IF v_caller_role = 'company_admin' THEN
    IF new_company_id IS NOT NULL AND new_company_id <> v_effective_company THEN
      RAISE EXCEPTION 'Access Denied: company_admin cannot create users in other companies';
    END IF;
    -- Always use their own company_id
    v_effective_company := v_effective_company;
  ELSE
    -- super_admin must specify a company
    IF new_company_id IS NULL THEN
      RAISE EXCEPTION 'Company ID is required for super_admin to create users';
    END IF;
    v_effective_company := new_company_id;
  END IF;

  -- Validate role
  IF new_role NOT IN ('company_admin', 'collaborator', 'employee') THEN
    RAISE EXCEPTION 'Invalid role: must be company_admin, collaborator, or employee';
  END IF;

  -- Verify the company exists
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = v_effective_company) THEN
    RAISE EXCEPTION 'Company % does not exist', v_effective_company;
  END IF;

  v_new_user_id := gen_random_uuid();

  -- Insert into auth.users — NO confirmed_at (generated column in modern Supabase)
  -- email_confirmed_at IS fine and sets the confirmation state correctly
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
    '', '', '', '', '', '', '', ''  -- empty token fields to avoid GoTrue scan errors
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

-- Permisos
REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, uuid, text, uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, uuid, text, uuid, date, text) TO authenticated;
