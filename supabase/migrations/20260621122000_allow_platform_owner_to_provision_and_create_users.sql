-- ================================================================
-- MIGRATION: Permitir a platform_owner provisionar tenants y crear admins
-- FECHA: 2026-06-21
-- PROBLEMA: El platform_owner real (jarias7604@gmail.com) tiene rol 
--           'company_admin' pero is_platform_owner = true. 
--           Las funciones checkeaban estrictamente role = 'super_admin',
--           impidiendo la creación de nuevas empresas por el dueño de la plataforma.
-- ================================================================

CREATE OR REPLACE FUNCTION public.provision_new_tenant(
  p_company_name          text,
  p_license_status        text         DEFAULT 'active',
  p_rnc                   text         DEFAULT NULL,
  p_telefono              text         DEFAULT NULL,
  p_email                 text         DEFAULT NULL,
  p_direccion             text         DEFAULT NULL,
  p_max_users             int          DEFAULT 10,
  p_allowed_permissions   text[]       DEFAULT ARRAY['leads','quotes','calendar'],
  p_admin_email           text         DEFAULT NULL,
  p_admin_password        text         DEFAULT NULL,
  p_admin_full_name       text         DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role    text;
  v_caller_is_platform_owner boolean;
  v_company_id     uuid;
  v_admin_user_id  uuid;
BEGIN
  -- Solo super_admin o platform_owner puede crear empresas nuevas
  SELECT role, is_platform_owner 
  INTO v_caller_role, v_caller_is_platform_owner
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role != 'super_admin' AND NOT COALESCE(v_caller_is_platform_owner, false) THEN
    RAISE EXCEPTION 'Only super_admin can provision new tenants';
  END IF;

  -- 1. Crear la empresa con columnas REALES de la tabla companies
  INSERT INTO public.companies (
    id,
    name,
    license_status,
    rnc,
    telefono,
    email,
    direccion,
    max_users,
    allowed_permissions,
    created_at
  ) VALUES (
    gen_random_uuid(),
    p_company_name,
    p_license_status,
    p_rnc,
    p_telefono,
    p_email,
    p_direccion,
    p_max_users,
    to_jsonb(p_allowed_permissions),
    now()
  ) RETURNING id INTO v_company_id;

  -- 2. Crear el admin inicial si se especificó
  IF p_admin_email IS NOT NULL AND p_admin_password IS NOT NULL THEN
    v_admin_user_id := gen_random_uuid();

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
      v_admin_user_id,
      '00000000-0000-0000-0000-000000000000',
      p_admin_email,
      extensions.crypt(p_admin_password, extensions.gen_salt('bf')),
      now(),
      'authenticated',
      'authenticated',
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', COALESCE(p_admin_full_name, p_admin_email)),
      '', '', '', '', '', '', '', ''
    );

    -- Identidad asociada para el login correcto del nuevo usuario
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
      v_admin_user_id,
      v_admin_user_id::text,
      v_admin_user_id,
      jsonb_build_object(
        'sub',            v_admin_user_id::text,
        'email',          p_admin_email,
        'email_verified', true
      ),
      'email',
      now(),
      now(),
      now()
    );

    -- Perfil con el company_id de la NUEVA empresa (no de otra)
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      role,
      company_id,         -- ← SIEMPRE la nueva empresa
      is_active,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_admin_user_id,
      p_admin_email,
      COALESCE(p_admin_full_name, p_admin_email),
      'company_admin',
      v_company_id,       -- ← La empresa recién creada, nunca NULL
      true,
      'active',
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      role       = 'company_admin',
      company_id = v_company_id,
      is_active  = true,
      status     = 'active',
      updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'company_id',   v_company_id,
    'company_name', p_company_name,
    'admin_email',  p_admin_email,
    'admin_id',     v_admin_user_id,
    'status',       'provisioned'
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Email % already exists in the system', p_admin_email;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error provisioning tenant: %', SQLERRM;
END;
$$;

-- Permisos provision_new_tenant
REVOKE ALL ON FUNCTION public.provision_new_tenant(text, text, text, text, text, text, int, text[], text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_new_tenant(text, text, text, text, text, text, int, text[], text, text, text) TO authenticated;


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

  -- Validate role
  IF new_role NOT IN ('company_admin', 'collaborator', 'employee') THEN
    RAISE EXCEPTION 'Invalid role: must be company_admin, collaborator, or employee';
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

-- Permisos admin_create_user
REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, uuid, text, uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, uuid, text, uuid, date, text) TO authenticated;
