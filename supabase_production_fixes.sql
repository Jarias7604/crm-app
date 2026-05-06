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


-- ================================================================
-- FEATURE: Sistema de Calendarios Multi-Grupo
-- Permite al admin crear múltiples calendarios compartidos
-- y asignar acceso por usuario individual o por rol
-- ================================================================

-- Tabla 1: Calendarios compartidos de la empresa
CREATE TABLE IF NOT EXISTS company_calendars (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  color           TEXT        NOT NULL DEFAULT '#4285F4',
  integration_id  UUID        REFERENCES calendar_integrations(id) ON DELETE SET NULL,
  created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla 2: Control de acceso — quién ve qué calendario
CREATE TABLE IF NOT EXISTS calendar_access (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_calendar_id UUID        NOT NULL REFERENCES company_calendars(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  can_view            BOOLEAN     NOT NULL DEFAULT true,
  granted_by          UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_calendar_id, user_id)
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_company_calendars_company_id ON company_calendars(company_id);
CREATE INDEX IF NOT EXISTS idx_calendar_access_user_id ON calendar_access(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_access_calendar_id ON calendar_access(company_calendar_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_company_calendars_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_company_calendars_updated_at ON company_calendars;
CREATE TRIGGER trg_company_calendars_updated_at
  BEFORE UPDATE ON company_calendars
  FOR EACH ROW EXECUTE FUNCTION update_company_calendars_updated_at();

-- -- RLS ----------------------------------------------------------

ALTER TABLE company_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_access ENABLE ROW LEVEL SECURITY;

-- company_calendars: todos en la empresa pueden leer
DROP POLICY IF EXISTS company_calendars_select ON company_calendars;
CREATE POLICY company_calendars_select ON company_calendars FOR SELECT TO authenticated
  USING (company_id = get_auth_company_id());

-- company_calendars: solo admin puede crear/editar/borrar
DROP POLICY IF EXISTS company_calendars_admin ON company_calendars;
CREATE POLICY company_calendars_admin ON company_calendars
  FOR ALL TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1)
        = ANY (ARRAY['company_admin'::app_role, 'super_admin'::app_role])
  )
  WITH CHECK (
    company_id = get_auth_company_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1)
        = ANY (ARRAY['company_admin'::app_role, 'super_admin'::app_role])
  );

-- calendar_access: usuario solo ve sus propios accesos (o si es admin ve todo)
DROP POLICY IF EXISTS calendar_access_user_select ON calendar_access;
CREATE POLICY calendar_access_user_select ON calendar_access FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('company_admin'::app_role, 'super_admin'::app_role)
      AND company_id = get_auth_company_id()
    )
  );

-- calendar_access: solo admin puede gestionar accesos
DROP POLICY IF EXISTS calendar_access_admin ON calendar_access;
CREATE POLICY calendar_access_admin ON calendar_access
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_calendars cc
      WHERE cc.id = calendar_access.company_calendar_id
      AND cc.company_id = get_auth_company_id()
      AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1)
          = ANY (ARRAY['company_admin'::app_role, 'super_admin'::app_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_calendars cc
      WHERE cc.id = calendar_access.company_calendar_id
      AND cc.company_id = get_auth_company_id()
      AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1)
          = ANY (ARRAY['company_admin'::app_role, 'super_admin'::app_role])
    )
  );

CREATE TABLE IF NOT EXISTS public.client_stage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.client_pipeline_stages(id) ON DELETE CASCADE,
    entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    exited_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_client_stage_history_client ON public.client_stage_history(client_id);
CREATE INDEX IF NOT EXISTS idx_client_stage_history_stage ON public.client_stage_history(stage_id);

-- Enable RLS
ALTER TABLE public.client_stage_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view history in their company"
    ON public.client_stage_history FOR SELECT
    USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert history in their company"
    ON public.client_stage_history FOR INSERT
    WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update history in their company"
    ON public.client_stage_history FOR UPDATE
    USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Trigger function
CREATE OR REPLACE FUNCTION public.log_client_stage_change()
RETURNS TRIGGER AS \$\$
BEGIN
    -- If the stage hasn't changed, do nothing
    IF (TG_OP = 'UPDATE' AND OLD.etapa_actual_id = NEW.etapa_actual_id) THEN
        RETURN NEW;
    END IF;

    -- If there was a previous stage, mark it as exited
    IF (TG_OP = 'UPDATE' AND OLD.etapa_actual_id IS NOT NULL) THEN
        UPDATE public.client_stage_history
        SET exited_at = NOW()
        WHERE client_id = NEW.id AND stage_id = OLD.etapa_actual_id AND exited_at IS NULL;
    END IF;

    -- Log the new stage entry
    IF (NEW.etapa_actual_id IS NOT NULL) THEN
        INSERT INTO public.client_stage_history (company_id, client_id, stage_id, entered_at)
        VALUES (NEW.company_id, NEW.id, NEW.etapa_actual_id, NOW());
    END IF;

    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_client_stage_change ON public.clients;

CREATE TRIGGER trigger_log_client_stage_change
AFTER INSERT OR UPDATE OF etapa_actual_id ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.log_client_stage_change();

