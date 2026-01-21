-- 🚀 RECUPERACIÓN DE CUENTA ADMINISTRADOR

-- Este script repara tu cuenta principal (jarias@ariasdefense.com)
-- 1. Le asigna la contraseña '123456'
-- 2. Le inyecta los metadatos necesarios para pasar la seguridad (company_id)
-- 3. Lo convierte en Super Admin para tener control total.

CREATE OR REPLACE FUNCTION public.fix_my_admin_account()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_uid uuid;
    v_cid uuid;
BEGIN
    -- 1. Buscar el usuario
    SELECT id INTO v_uid FROM auth.users WHERE email = 'jarias@ariasdefense.com';
    
    IF v_uid IS NULL THEN
        RETURN 'Error: El usuario no existe. Debes crearlo primero.';
    END IF;

    -- 2. Buscar o asignar empresa
    SELECT company_id INTO v_cid FROM public.profiles WHERE id = v_uid;
    
    IF v_cid IS NULL THEN
        SELECT id INTO v_cid FROM public.companies LIMIT 1;
        -- Si no hay perfil, lo creamos
        INSERT INTO public.profiles (id, email, role, company_id, full_name, is_active)
        VALUES (v_uid, 'jarias@ariasdefense.com', 'super_admin'::app_role, v_cid, 'Admin Arias', true)
        ON CONFLICT (id) DO UPDATE SET company_id = v_cid, role = 'super_admin'::app_role;
    END IF;

    -- 3. ACTUALIZACIÓN CRÍTICA (Metadatos + Password)
    UPDATE auth.users 
    SET encrypted_password = crypt('123456', gen_salt('bf')),
        email_confirmed_at = now(),
        raw_app_meta_data = jsonb_build_object(
            'provider', 'email', 
            'providers', array['email'], 
            'role', 'super_admin',       -- Te hacemos Super Admin
            'company_id', v_cid          -- CRÍTICO: Sin esto no entras
        ),
        is_super_admin = true
    WHERE id = v_uid;

    RETURN '✅ Cuenta reparada. Login: jarias@ariasdefense.com / 123456';
END;
$$;

-- Ejecutar reparación
SELECT public.fix_my_admin_account();
