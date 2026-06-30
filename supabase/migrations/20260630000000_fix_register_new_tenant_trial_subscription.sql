-- ============================================================
-- FIX: register_new_tenant → add 15-day trial subscription
-- DATE: 2026-06-30
-- DB: PRODUCCIÓN mtxqqamitglhehaktgxm
-- PROBLEMA: La función creaba la empresa pero nunca registraba
--           la suscripción en company_subscriptions.
--           Resultado: OnboardingWizard sin plan, BillingManager
--           sin trial, get_company_subscription() devuelve vacío.
-- SOLUCIÓN: Agregar INSERT en company_subscriptions con 15 días
--           de trial usando el plan 'starter' como base.
-- ============================================================

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
  v_result      jsonb;
BEGIN
  -- 1. Verificar autenticación
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Verificar que el usuario no pertenece ya a una empresa
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND company_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;

  -- 3. Crear la empresa en estado trial
  INSERT INTO companies (
    id,
    name,
    license_status,
    max_users,
    allowed_permissions,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    company_name,
    'trial',
    5,
    ARRAY['leads', 'quotes', 'calendar', 'loss_reasons'],
    now(),
    now()
  ) RETURNING id INTO v_company_id;

  -- 4. Crear o actualizar el perfil del usuario como company_admin
  INSERT INTO profiles (id, email, full_name, role, company_id, is_active, created_at, updated_at)
  SELECT
    v_user_id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    'company_admin',
    v_company_id,
    true,
    now(),
    now()
  FROM auth.users au
  WHERE au.id = v_user_id
  ON CONFLICT (id) DO UPDATE SET
    role        = 'company_admin',
    company_id  = v_company_id,
    is_active   = true,
    updated_at  = now();

  -- 5. Crear suscripción trial de 15 días en company_subscriptions
  --    Usamos el plan 'starter' como base (el de menor tier).
  --    Si no existe el plan, la inserción es silenciosa (ON CONFLICT DO NOTHING).
  SELECT id INTO v_plan_id
  FROM saas_plans
  WHERE slug = 'starter' AND is_active = true
  LIMIT 1;

  -- Si no hay plan starter, intentar con pro como fallback
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id
    FROM saas_plans
    WHERE is_active = true
    ORDER BY sort_order ASC
    LIMIT 1;
  END IF;

  IF v_plan_id IS NOT NULL THEN
    INSERT INTO company_subscriptions (
      company_id,
      plan_id,
      status,
      billing_cycle,
      trial_ends_at,
      current_period_start,
      current_period_end,
      created_at,
      updated_at
    ) VALUES (
      v_company_id,
      v_plan_id,
      'trialing',
      'monthly',
      now() + interval '15 days',
      now(),
      now() + interval '15 days',
      now(),
      now()
    )
    ON CONFLICT (company_id) DO NOTHING;
  END IF;

  v_result := jsonb_build_object(
    'company_id',   v_company_id,
    'company_name', company_name,
    'plan_id',      v_plan_id,
    'trial_ends_at', (now() + interval '15 days')::text,
    'status',       'trial'
  );

  RETURN v_result;
END;
$$;

-- Permisos (igual que antes)
REVOKE ALL ON FUNCTION public.register_new_tenant(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_new_tenant(TEXT) TO authenticated;

SELECT 'register_new_tenant updated — now creates 15-day trial subscription' AS result;
