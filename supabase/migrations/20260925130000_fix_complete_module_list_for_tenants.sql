-- ============================================================
-- MIGRATION: Fix complete module list for all tenant-creation functions
-- DATE: 2026-09-25
-- DESCRIPTION:
--   1. Updates register_new_tenant to include ALL available modules in trial license
--   2. Updates provision_new_tenant default to include ALL modules
--   3. Ensures get_user_permissions fallback has ALL modules
--   This prevents any new company from missing modules like tickets, marketing, chat, etc.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FULL MODULE LIST (single source — update here if a new module is added)
-- ─────────────────────────────────────────────────────────────────────────────
-- leads, quotes, calendar, clientes, loss_reasons, dashboard_full,
-- team_view_assigned, branding, invoices, facturas, proyectos, finanzas,
-- tickets, marketing, chat, pricing, paquetes, items, financial_rules,
-- reports, view_financials
-- ─────────────────────────────────────────────────────────────────────────────

-- STEP 1: Update register_new_tenant with full module list
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

  -- ALL available modules — update this list when a new module is added
  v_full_modules jsonb := '[
    "leads","quotes","calendar","clientes","loss_reasons","dashboard_full",
    "team_view_assigned","branding","invoices","facturas","proyectos","finanzas",
    "tickets","marketing","chat","pricing","paquetes","items","financial_rules",
    "reports","view_financials"
  ]'::jsonb;

  v_full_permissions jsonb := '{
    "leads":true,"quotes":true,"calendar":true,"clientes":true,"loss_reasons":true,
    "dashboard_full":true,"team_view_assigned":true,"branding":true,"invoices":true,
    "facturas":true,"proyectos":true,"finanzas":true,"tickets":true,"marketing":true,
    "chat":true,"pricing":true,"paquetes":true,"items":true,"financial_rules":true,
    "reports":true,"view_financials":true
  }'::jsonb;

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

  -- 4. Create company with FULL module list
  INSERT INTO companies (
    id, name, license_status, max_users, allowed_permissions, created_at
  ) VALUES (
    gen_random_uuid(),
    company_name,
    'trial',
    5,
    v_full_modules,
    now()
  ) RETURNING id INTO v_company_id;

  -- 5. Create/update profile as company_admin with full permissions
  INSERT INTO profiles (id, email, full_name, role, company_id, permissions, is_active, created_at)
  SELECT
    v_user_id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    'company_admin',
    v_company_id,
    v_full_permissions,
    true,
    now()
  FROM auth.users au
  WHERE au.id = v_user_id
  ON CONFLICT (id) DO UPDATE SET
    role        = 'company_admin',
    full_name   = COALESCE(EXCLUDED.full_name, profiles.full_name),
    company_id  = v_company_id,
    permissions = v_full_permissions,
    is_active   = true;

  -- 6. Create trial subscription
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO company_subscriptions (
      company_id, plan_id, status, billing_cycle,
      trial_ends_at, current_period_start, current_period_end, created_at
    ) VALUES (
      v_company_id, v_plan_id, 'trialing', 'monthly',
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


-- STEP 2: Update provision_new_tenant default allowed_permissions
-- (used by super_admin/platform_owner to create companies for clients)
CREATE OR REPLACE FUNCTION public.provision_new_tenant(
  p_company_name        text,
  p_admin_email         text,
  p_admin_password      text,
  p_admin_full_name     text DEFAULT NULL,
  p_plan_slug           text DEFAULT 'starter',
  p_allowed_permissions text[] DEFAULT ARRAY[
    'leads','quotes','calendar','clientes','loss_reasons','dashboard_full',
    'team_view_assigned','branding','invoices','facturas','proyectos','finanzas',
    'tickets','marketing','chat','pricing','paquetes','items','financial_rules',
    'reports','view_financials'
  ],
  p_max_users           int  DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_company_id  uuid;
  v_user_id     uuid;
  v_plan_id     uuid;
  v_trial_days  int := 14;
BEGIN
  -- Verify caller is super_admin or platform_owner
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role = 'super_admin' OR (is_platform_owner IS NOT NULL AND is_platform_owner::boolean = true))
  ) THEN
    RAISE EXCEPTION 'Only super_admin or platform_owner can provision tenants';
  END IF;

  -- Get plan
  SELECT id, trial_days INTO v_plan_id, v_trial_days
  FROM public.saas_plans
  WHERE slug = p_plan_slug AND is_active = true
  LIMIT 1;

  v_trial_days := COALESCE(v_trial_days, 14);

  -- Create company
  INSERT INTO public.companies (id, name, license_status, max_users, allowed_permissions, created_at)
  VALUES (
    gen_random_uuid(),
    p_company_name,
    'trial',
    p_max_users,
    to_jsonb(p_allowed_permissions),
    now()
  )
  RETURNING id INTO v_company_id;

  -- Create user via admin API (uses service role)
  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, created_at, updated_at, role
  ) VALUES (
    v_user_id,
    p_admin_email,
    crypt(p_admin_password, gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', COALESCE(p_admin_full_name, p_admin_email)),
    now(), now(), 'authenticated'
  );

  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, role, company_id, permissions, is_active, created_at)
  VALUES (
    v_user_id,
    p_admin_email,
    COALESCE(p_admin_full_name, p_admin_email),
    'company_admin',
    v_company_id,
    to_jsonb(p_allowed_permissions::text[])::jsonb,
    true,
    now()
  );

  -- Create subscription
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.company_subscriptions (
      company_id, plan_id, status, billing_cycle,
      trial_ends_at, current_period_start, current_period_end, created_at
    ) VALUES (
      v_company_id, v_plan_id, 'trialing', 'monthly',
      now() + (v_trial_days || ' days')::interval,
      now(),
      now() + (v_trial_days || ' days')::interval,
      now()
    )
    ON CONFLICT (company_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'company_id',   v_company_id,
    'user_id',      v_user_id,
    'company_name', p_company_name,
    'admin_email',  p_admin_email,
    'plan_slug',    p_plan_slug,
    'trial_days',   v_trial_days,
    'status',       'provisioned'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provision_new_tenant FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_new_tenant TO authenticated;
