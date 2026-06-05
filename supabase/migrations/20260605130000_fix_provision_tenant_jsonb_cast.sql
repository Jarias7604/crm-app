-- ================================================================
-- FIX: provision_new_tenant — cast text[] → jsonb para companies.allowed_permissions
-- La columna companies.allowed_permissions es jsonb, no text[]
-- La función debe usar to_jsonb() al insertar
-- DB: PRODUCCIÓN mtxqqamitglhehaktgxm
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
SET search_path = public, auth
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

  -- 1. Crear la empresa
  -- CLAVE: to_jsonb(p_allowed_permissions) convierte text[] a jsonb
  -- porque companies.allowed_permissions es de tipo jsonb
  INSERT INTO companies (
    id,
    name,
    license_status,
    tax_id,
    phone,
    address,
    max_users,
    allowed_permissions,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_company_name,
    p_license_status,
    p_rnc,
    p_telefono,
    p_direccion,
    p_max_users,
    to_jsonb(p_allowed_permissions),   -- ← cast correcto text[] → jsonb
    now(),
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
      raw_user_meta_data
    ) VALUES (
      v_admin_user_id,
      '00000000-0000-0000-0000-000000000000',
      p_admin_email,
      crypt(p_admin_password, gen_salt('bf')),
      now(),
      'authenticated',
      'authenticated',
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', COALESCE(p_admin_full_name, p_admin_email))
    );

    -- Perfil con el company_id de la NUEVA empresa (nunca NULL)
    INSERT INTO profiles (
      id,
      email,
      full_name,
      role,
      company_id,
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

-- Permisos
REVOKE ALL ON FUNCTION public.provision_new_tenant(text, text, text, text, text, text, int, text[], text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_new_tenant(text, text, text, text, text, text, int, text[], text, text, text) TO authenticated;
