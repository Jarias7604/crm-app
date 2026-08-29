-- ============================================================
-- MIGRATION: Fix trial onboarding, full_name sync & get_user_permissions SSOT
-- DATE: 2026-08-29
-- DESCRIPTION:
--   1. Updates get_user_permissions to return full tenant module permissions
--      for company_admin when custom_role_id is NULL.
--   2. Updates register_new_tenant to populate full trial modules and full_name.
-- ============================================================

-- 1. UPDATE: get_user_permissions RPC
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_id            uuid;
    v_profile_role       text;
    v_company_id         uuid;
    v_profile_perms      jsonb;
    v_role_permissions   jsonb;
    v_allowed_perms      jsonb;
BEGIN
    -- 1. Obtener datos del perfil
    SELECT role, custom_role_id, company_id, permissions
    INTO v_profile_role, v_role_id, v_company_id, v_profile_perms
    FROM public.profiles
    WHERE id = user_id;

    -- 2. Super Admin: acceso total a todos los módulos
    IF v_profile_role = 'super_admin' THEN
        SELECT jsonb_object_agg(permission_key, true)
        INTO v_role_permissions
        FROM public.permission_definitions;
        RETURN COALESCE(v_role_permissions, '{}'::jsonb);
    END IF;

    -- 3. Si tiene custom_role asignado, leer directamente de role_permissions (donde is_enabled = true)
    IF v_role_id IS NOT NULL THEN
        SELECT jsonb_object_agg(permission_key, is_enabled)
        INTO v_role_permissions
        FROM public.role_permissions
        WHERE role_id = v_role_id AND is_enabled = true;

        IF v_role_permissions IS NOT NULL AND jsonb_typeof(v_role_permissions) = 'object' THEN
            RETURN v_role_permissions;
        END IF;

        -- Fallback a custom_roles.permissions si no hay filas en role_permissions
        SELECT permissions
        INTO v_role_permissions
        FROM public.custom_roles
        WHERE id = v_role_id;

        IF v_role_permissions IS NOT NULL THEN
            RETURN v_role_permissions;
        END IF;
    END IF;

    -- 4. Si es company_admin (sin custom_role_id), retornar permisos del perfil o de la empresa
    IF v_profile_role = 'company_admin' THEN
        IF v_profile_perms IS NOT NULL AND jsonb_typeof(v_profile_perms) = 'object' AND v_profile_perms != '{}'::jsonb THEN
            RETURN v_profile_perms;
        END IF;

        -- Fallback: módulos estándar de la empresa / trial
        IF v_company_id IS NOT NULL THEN
            SELECT allowed_permissions
            INTO v_allowed_perms
            FROM public.companies
            WHERE id = v_company_id;

            IF v_allowed_perms IS NOT NULL AND jsonb_typeof(v_allowed_perms) = 'array' THEN
                SELECT jsonb_object_agg(elem, true)
                INTO v_role_permissions
                FROM jsonb_array_elements_text(v_allowed_perms) AS elem;

                RETURN COALESCE(v_role_permissions, '{}'::jsonb);
            END IF;
        END IF;

        -- Default fallback para nuevo trial admin
        RETURN jsonb_build_object(
            'leads', true,
            'quotes', true,
            'calendar', true,
            'clientes', true,
            'loss_reasons', true,
            'dashboard_full', true,
            'team_view_assigned', true,
            'branding', true,
            'invoices', true,
            'facturas', true,
            'proyectos', true,
            'finanzas', true
        );
    END IF;

    -- 5. Fallback para cualquier otro usuario con profiles.permissions
    IF v_profile_perms IS NOT NULL AND jsonb_typeof(v_profile_perms) = 'object' THEN
        RETURN v_profile_perms;
    END IF;

    RETURN '{}'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated;

-- 2. UPDATE: register_new_tenant RPC
CREATE OR REPLACE FUNCTION public.register_new_tenant(company_name TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id     uuid;
  v_company_id  uuid;
  v_plan_id     uuid;
  v_trial_days  integer := 14;
  v_user_name   text;
  v_result      jsonb;
BEGIN
  -- 1. Verify authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Verify user does not already belong to a company
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND company_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;

  -- 3. Get starter plan + trial_days
  SELECT id, trial_days
  INTO v_plan_id, v_trial_days
  FROM saas_plans
  WHERE slug = 'starter' AND is_active = true
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    SELECT id, trial_days
    INTO v_plan_id, v_trial_days
    FROM saas_plans
    WHERE is_active = true
    ORDER BY sort_order ASC
    LIMIT 1;
  END IF;

  v_trial_days := COALESCE(v_trial_days, 14);

  -- Extract user name from auth metadata if available
  SELECT COALESCE(raw_user_meta_data->>'full_name', email)
  INTO v_user_name
  FROM auth.users
  WHERE id = v_user_id;

  -- 4. Create company in trial state with full standard trial modules
  INSERT INTO companies (
    id,
    name,
    license_status,
    max_users,
    allowed_permissions,
    created_at
  ) VALUES (
    gen_random_uuid(),
    company_name,
    'trial',
    5,
    '["leads","quotes","calendar","clientes","loss_reasons","dashboard_full","team_view_assigned","branding","invoices","facturas","proyectos","finanzas"]'::jsonb,
    now()
  ) RETURNING id INTO v_company_id;

  -- 5. Create/update profile as company_admin with trial permissions
  INSERT INTO profiles (id, email, full_name, role, company_id, permissions, is_active, created_at)
  SELECT
    v_user_id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    'company_admin',
    v_company_id,
    '{"leads":true,"quotes":true,"calendar":true,"clientes":true,"loss_reasons":true,"dashboard_full":true,"team_view_assigned":true,"branding":true,"invoices":true,"facturas":true,"proyectos":true,"finanzas":true}'::jsonb,
    true,
    now()
  FROM auth.users au
  WHERE au.id = v_user_id
  ON CONFLICT (id) DO UPDATE SET
    role        = 'company_admin',
    full_name   = COALESCE(EXCLUDED.full_name, profiles.full_name),
    company_id  = v_company_id,
    permissions = '{"leads":true,"quotes":true,"calendar":true,"clientes":true,"loss_reasons":true,"dashboard_full":true,"team_view_assigned":true,"branding":true,"invoices":true,"facturas":true,"proyectos":true,"finanzas":true}'::jsonb,
    is_active   = true;

  -- 6. Create trial subscription
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO company_subscriptions (
      company_id,
      plan_id,
      status,
      billing_cycle,
      trial_ends_at,
      current_period_start,
      current_period_end,
      created_at
    ) VALUES (
      v_company_id,
      v_plan_id,
      'trialing',
      'monthly',
      now() + (v_trial_days || ' days')::interval,
      now(),
      now() + (v_trial_days || ' days')::interval,
      now()
    )
    ON CONFLICT (company_id) DO NOTHING;
  END IF;

  v_result := jsonb_build_object(
    'company_id',    v_company_id,
    'company_name',  company_name,
    'plan_id',       v_plan_id,
    'trial_days',    v_trial_days,
    'trial_ends_at', (now() + (v_trial_days || ' days')::interval)::text,
    'status',        'trial'
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.register_new_tenant(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_new_tenant(TEXT) TO authenticated;
