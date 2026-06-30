-- ============================================================
-- FIX: register_new_tenant — correct columns + dynamic trial_days
-- DATE: 2026-06-30
-- FIXES:
--   1. companies.updated_at does not exist → removed
--   2. companies.allowed_permissions is jsonb, not text[] → fixed
--   3. profiles missing trial permissions on creation → added
--   4. Trial days now DYNAMIC: read from saas_plans.trial_days
--      (change from the SaaS Plan Manager UI, no code needed)
-- ============================================================

-- Step 1: Add trial_days column to saas_plans (if not exists)
ALTER TABLE saas_plans
  ADD COLUMN IF NOT EXISTS trial_days INTEGER NOT NULL DEFAULT 14;

-- Set current plans to 14 days
UPDATE saas_plans SET trial_days = 14 WHERE trial_days = 14 OR trial_days IS NULL;

-- Step 2: Replace function — now reads trial_days from plan
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
  v_trial_days  integer := 14;  -- fallback default
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

  -- 3. Get starter plan + trial_days (dynamic — editable from SaaS Plan Manager)
  SELECT id, trial_days
  INTO v_plan_id, v_trial_days
  FROM saas_plans
  WHERE slug = 'starter' AND is_active = true
  LIMIT 1;

  -- Fallback: any active plan
  IF v_plan_id IS NULL THEN
    SELECT id, trial_days
    INTO v_plan_id, v_trial_days
    FROM saas_plans
    WHERE is_active = true
    ORDER BY sort_order ASC
    LIMIT 1;
  END IF;

  -- Ensure trial_days has a value
  v_trial_days := COALESCE(v_trial_days, 14);

  -- 4. Create company in trial state
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
    '["leads","quotes","calendar","clientes","loss_reasons","dashboard_full","team_view_assigned"]'::jsonb,
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
    '{"leads":true,"quotes":true,"calendar":true,"clientes":true,"loss_reasons":true,"dashboard_full":true,"team_view_assigned":true}'::jsonb,
    true,
    now()
  FROM auth.users au
  WHERE au.id = v_user_id
  ON CONFLICT (id) DO UPDATE SET
    role        = 'company_admin',
    company_id  = v_company_id,
    permissions = '{"leads":true,"quotes":true,"calendar":true,"clientes":true,"loss_reasons":true,"dashboard_full":true,"team_view_assigned":true}'::jsonb,
    is_active   = true;

  -- 6. Create trial subscription using dynamic trial_days from plan
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

-- Permissions
REVOKE ALL ON FUNCTION public.register_new_tenant(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_new_tenant(TEXT) TO authenticated;

SELECT 'register_new_tenant: dynamic trial_days from saas_plans, correct column types' AS result;
