-- 🚀 REPARACIÓN FINAL y DEFINITIVA PRO (V8)
-- Este script APRENDE de los errores anteriores:
-- 1. No toca esquema auth directamente (evita error 42501).
-- 2. No intenta escribir en columnas generadas (evita error 428C9).
-- 3. Crea funciones que hacen el trabajo sucio con permisos elevados (SECURITY DEFINER).

-- =================================================================
-- 1. UTILERÍAS DE SEGURIDAD (Lectura rápida del Token)
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_auth_company_id() RETURNS uuid AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'company_id', ''))::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.get_auth_role() RETURNS text AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role';
$$ LANGUAGE sql STABLE;


-- =================================================================
-- 2. LIMPIEZA DE BASURA ANTIGUA
-- =================================================================
DO $$ 
DECLARE r RECORD;
BEGIN
  -- Borramos todas las políticas viejas y rotas
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
  END LOOP;
END $$;


-- =================================================================
-- 3. SEGURIDAD SAAS (Simple, Rápida y Segura)
-- =================================================================
-- Companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "co_read" ON public.companies FOR SELECT TO authenticated 
USING (id = public.get_auth_company_id() OR public.get_auth_role() = 'super_admin');

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pf_read" ON public.profiles FOR SELECT TO authenticated 
USING (company_id = public.get_auth_company_id() OR public.get_auth_role() = 'super_admin');

CREATE POLICY "pf_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_isolation" ON public.leads FOR ALL TO authenticated 
USING (
    public.get_auth_role() = 'super_admin' 
    OR (company_id = public.get_auth_company_id() AND (public.get_auth_role() = 'company_admin' OR assigned_to = auth.uid()))
);


-- =================================================================
-- 4. HERRAMIENTA DE CREACIÓN (Fix para Usuarios Nuevos)
-- =================================================================
CREATE OR REPLACE FUNCTION public.admin_create_user(
    new_email text,
    new_password text,
    new_role text,
    new_full_name text,
    new_company_id uuid,
    new_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- IMPORTANTE: Corre como superusuario
AS $$
DECLARE
    new_user_id uuid := gen_random_uuid();
BEGIN
    -- Validar permisos del que ejecuta
    IF NOT (public.get_auth_role() IN ('super_admin', 'company_admin')) THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    -- 1. Insertar Usuario en Auth
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
        new_email, crypt(new_password, gen_salt('bf')), now(), 
        jsonb_build_object(
            'provider', 'email', 
            'providers', array['email'], 
            'role', new_role, 
            'company_id', new_company_id
        ), 
        jsonb_build_object('full_name', new_full_name), 
        now(), now()
    );

    -- 2. Insertar Identidad (SIN tocar columna email generada)
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), new_user_id, 
        jsonb_build_object('sub', new_user_id, 'email', new_email, 'email_verified', true),
        'email', new_user_id, now(), now(), now()
    );

    -- 3. Insertar Perfil Público
    INSERT INTO public.profiles (id, email, role, company_id, full_name, phone, is_active)
    VALUES (new_user_id, new_email, new_role::app_role, new_company_id, new_full_name, new_phone, true);

    RETURN new_user_id;
END;
$$;


-- =================================================================
-- 5. REPARAR USUARIO EXISTENTE (Fix para Carlos, Diana, etc)
-- =================================================================
CREATE OR REPLACE FUNCTION public.fix_broken_user(target_email text, user_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_uid uuid;
    v_cid uuid;
    v_fullname text;
    v_role text;
BEGIN
    SELECT id, raw_user_meta_data->>'full_name' INTO v_uid, v_fullname 
    FROM auth.users WHERE email = target_email;

    IF v_uid IS NULL THEN RETURN 'Usuario no encontrado'; END IF;

    -- Recuperar datos del perfil si existen
    SELECT company_id, role::text INTO v_cid, v_role FROM public.profiles WHERE id = v_uid;
    
    -- Fallback si no hay perfil
    IF v_cid IS NULL THEN SELECT id INTO v_cid FROM public.companies LIMIT 1; END IF;
    IF v_role IS NULL THEN v_role := 'sales_agent'; END IF;

    -- 1. Resetear Password y Metadatos
    UPDATE auth.users 
    SET encrypted_password = crypt(user_password, gen_salt('bf')),
        email_confirmed_at = now(),
        raw_app_meta_data = jsonb_build_object(
            'provider', 'email', 
            'providers', array['email'], 
            'role', v_role, 
            'company_id', v_cid
        )
    WHERE id = v_uid;

    -- 2. Regenerar Identidad (Borrado seguro anterior)
    DELETE FROM auth.identities WHERE user_id = v_uid;
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_uid, 
        jsonb_build_object('sub', v_uid, 'email', target_email, 'email_verified', true),
        'email', v_uid, now(), now(), now()
    );

    RETURN 'Usuario ' || target_email || ' reparado exitosamente.';
END;
$$;

-- EJECUTAR REPARACIONES DE EMERGENCIA
SELECT public.fix_broken_user('carlos@gmail.com', '123456');
SELECT public.fix_broken_user('dmorales@ariasdefense.com', '123456');
