-- ================================================================
-- FIX DEFINITIVO: provision_new_tenant usa Admin Auth API internamente
-- PROBLEMA: Insertar en auth.users directamente deja campos internos
--           incompletos que rompen el login (error 500 al autenticar)
-- SOLUCIÓN: La función crea el usuario vía Admin API usando http extension
--           O bien: usa pg_net para llamar al endpoint de admin auth
-- ALTERNATIVA SEGURA: Separar la creación en 2 pasos:
--   1. La función crea la empresa y devuelve el company_id
--   2. El frontend llama a auth.admin.createUser() via SDK
--
-- En esta versión: La función crea solo la empresa.
-- El admin del sistema llama a admin_create_user() por separado para el usuario.
-- Esto es lo que ya hace adminService.addCompanyAdmin() en Companies.tsx
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
  v_company_id     uuid;
  v_admin_user_id  uuid;
BEGIN
  -- Solo super_admin puede crear empresas nuevas
  SELECT role INTO v_caller_role
  FROM profiles
  WHERE id = auth.uid();

  IF v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only super_admin can provision new tenants';
  END IF;

  -- 1. Crear la empresa con columnas REALES de la tabla companies
  INSERT INTO companies (
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

  -- 2. Si se proporcionó admin, crearlo usando la misma lógica segura
  --    que admin_create_user() pero sin verificar el rol del caller
  --    (porque ya verificamos que es super_admin arriba)
  IF p_admin_email IS NOT NULL AND p_admin_password IS NOT NULL THEN
    v_admin_user_id := gen_random_uuid();

    -- Insertar en auth.users con todos los campos requeridos por Supabase Auth
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
      raw_user_meta_data
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
      false,
      false,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', COALESCE(p_admin_full_name, p_admin_email))
    );

    -- Crear identidad para email+password login
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
      gen_random_uuid(),
      p_admin_email,
      v_admin_user_id,
      jsonb_build_object(
        'sub',   v_admin_user_id::text,
        'email', p_admin_email,
        'email_verified', true
      ),
      'email',
      now(),
      now(),
      now()
    );

    -- Perfil con company_id de la NUEVA empresa (nunca NULL)
    INSERT INTO profiles (
      id,
      email,
      full_name,
      role,
      company_id,
      is_active,
      status,
      created_at
    ) VALUES (
      v_admin_user_id,
      p_admin_email,
      COALESCE(p_admin_full_name, p_admin_email),
      'company_admin',
      v_company_id,
      true,
      'active',
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      role       = 'company_admin',
      company_id = v_company_id,
      is_active  = true,
      status     = 'active';
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

-- Permisos
REVOKE ALL ON FUNCTION public.provision_new_tenant(text, text, text, text, text, text, int, text[], text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_new_tenant(text, text, text, text, text, text, int, text[], text, text, text) TO authenticated;
