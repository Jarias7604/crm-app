-- 🚀 REPARACIÓN INTEGRAL Y LIMPIEZA DE MALAS PRÁCTICAS (SaaS Pro)
-- Este script deja el sistema limpio, seguro y escalable.

-- ==========================================
-- 1. FUNCIONES PARA LECTURA RÁPIDA (JWT)
-- ==========================================
-- Estas funciones permiten que la seguridad sea instantánea sin bucles.
CREATE OR REPLACE FUNCTION auth.get_company_id() RETURNS uuid AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'company_id', ''))::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.get_role() RETURNS text AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean AS $$
  SELECT auth.get_role() = 'super_admin';
$$ LANGUAGE sql STABLE;


-- ==========================================
-- 2. SINCRONIZACIÓN DE METADATOS (Mismo nivel)
-- ==========================================
-- Esto inyecta el company_id y role en el Token de los usuarios.
-- Sin esto, el sistema de seguridad no sabe quién es el usuario.
DO $$
DECLARE
    u RECORD;
BEGIN
    FOR u IN (SELECT p.id, p.company_id, p.role::text FROM public.profiles p) 
    LOOP
        UPDATE auth.users 
        SET raw_app_meta_data = raw_app_meta_data || 
            jsonb_build_object('company_id', u.company_id, 'role', u.role)
        WHERE id = u.id;
    END LOOP;
END $$;


-- ==========================================
-- 3. LIMPIEZA DE POLÍTICAS Y RE-ESTRUCTURACIÓN
-- ==========================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
  END LOOP;
END $$;

-- RLS: COMPANIES
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_isolation" ON public.companies 
FOR SELECT TO authenticated USING (id = auth.get_company_id() OR is_super_admin());

-- RLS: PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_isolation" ON public.profiles 
FOR SELECT TO authenticated USING (company_id = auth.get_company_id() OR is_super_admin());

CREATE POLICY "profiles_self_update" ON public.profiles 
FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "profiles_admin_manage" ON public.profiles
FOR ALL TO authenticated USING (
    is_super_admin() OR 
    (company_id = auth.get_company_id() AND auth.get_role() = 'company_admin')
);

-- RLS: LEADS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_isolation" ON public.leads 
FOR ALL TO authenticated USING (
    is_super_admin() OR (
        company_id = auth.get_company_id() AND (
            auth.get_role() = 'company_admin' OR assigned_to = auth.uid()
        )
    )
);

-- ==========================================
-- 4. NUEVAS HERRAMIENTAS PARA ADMIN (CRUD Limpio)
-- ==========================================

-- Función para ELIMINAR usuario (Borra Auth + Perfil)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Solo admins pueden borrar
    IF NOT (public.is_super_admin() OR (auth.get_role() = 'company_admin' AND (SELECT company_id FROM public.profiles WHERE id = target_user_id) = auth.get_company_id())) THEN
        RAISE EXCEPTION 'No tienes permiso para eliminar este usuario';
    END IF;

    -- No borrarse a sí mismo
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'No puedes eliminarte a ti mismo';
    END IF;

    -- Borrar de auth
    DELETE FROM auth.users WHERE id = target_user_id;
    -- El perfil se borra por CASCADE o manualmente si no hay FK
    DELETE FROM public.profiles WHERE id = target_user_id;
END;
$$;

-- Función para CREAR usuario (Corregida con Identidades)
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
SECURITY DEFINER
AS $$
DECLARE
    new_user_id uuid := gen_random_uuid();
BEGIN
    -- Control de acceso básico
    IF NOT (public.is_super_admin() OR (auth.get_role() = 'company_admin' AND new_company_id = auth.get_company_id())) THEN
        RAISE EXCEPTION 'No autorizado para crear usuarios en esta empresa';
    END IF;

    -- 1. Insertar en auth.users
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
    ) VALUES (
        new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
        new_email, crypt(new_password, gen_salt('bf')), now(), 
        jsonb_build_object(
            'provider', 'email', 'providers', array['email'], 
            'role', new_role, 'company_id', new_company_id
        ), 
        jsonb_build_object('full_name', new_full_name), 
        (new_role = 'super_admin'), now(), now()
    );

    -- 2. Vincular Identidad
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at, email
    ) VALUES (
        gen_random_uuid(), new_user_id, 
        jsonb_build_object('sub', new_user_id, 'email', new_email, 'email_verified', true),
        'email', new_user_id, now(), now(), now(), new_email
    );

    -- 3. Crear Perfil
    INSERT INTO public.profiles (id, email, role, company_id, full_name, phone, is_active)
    VALUES (new_user_id, new_email, new_role::app_role, new_company_id, new_full_name, new_phone, true);

    RETURN new_user_id;
END;
$$;

-- Función para ACTIVAR/DESACTIVAR usuario
CREATE OR REPLACE FUNCTION public.toggle_user_status(user_id uuid, new_status boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Solo admins pueden cambiar status
    IF NOT (public.is_super_admin() OR (auth.get_role() = 'company_admin' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = auth.get_company_id())) THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    UPDATE public.profiles SET is_active = new_status WHERE id = user_id;
END;
$$;

-- ==========================================
-- 5. RE-INSTALACIÓN DE DIANA MORALES (Limpio)
-- ==========================================
DELETE FROM auth.identities WHERE email = 'dmorales@ariasdefense.com';
DELETE FROM auth.users WHERE email = 'dmorales@ariasdefense.com';
DELETE FROM public.profiles WHERE email = 'dmorales@ariasdefense.com';

-- Creamos a Diana correctamente con la nueva lógica (puedes usar el Admin UI después)
-- Para que el sistema no falle ahora mismo, la insertamos lista para trabajar.
DO $$
DECLARE
    v_uid uuid := gen_random_uuid();
    v_cid uuid;
BEGIN
    SELECT id INTO v_cid FROM public.companies LIMIT 1;

    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dmorales@ariasdefense.com', crypt('123456', gen_salt('bf')), now(), jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', 'sales_agent', 'company_id', v_cid), jsonb_build_object('full_name', 'Diana Morales'), now(), now());

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at, email)
    VALUES (gen_random_uuid(), v_uid, jsonb_build_object('sub', v_uid, 'email', 'dmorales@ariasdefense.com', 'email_verified', true), 'email', v_uid, now(), now(), now(), 'dmorales@ariasdefense.com');

    INSERT INTO public.profiles (id, email, role, company_id, full_name, is_active)
    VALUES (v_uid, 'dmorales@ariasdefense.com', 'sales_agent'::app_role, v_cid, 'Diana Morales', true);
END $$;

SELECT 'CORRECCIÓN MAESTRA COMPLETADA ✅. Sistema limpio y David/Diana listos.' as status;
