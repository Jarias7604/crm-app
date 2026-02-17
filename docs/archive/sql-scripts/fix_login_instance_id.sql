-- Solución para problemas de Login con usuarios creados
-- 1. Actualizamos admin_create_user para usar el instance_id correcto
-- 2. Reparamos el usuario dmorales@ariasdefense.com

-- PARTE 1: Reparar admin_create_user para obtener el instance_id dinámicamente
CREATE OR REPLACE FUNCTION admin_create_user(
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
    new_user_id uuid;
    executing_user_role text;
    executing_user_company uuid;
    v_instance_id uuid; -- Nuevo: variable para capturar el instance_id real
BEGIN
    -- Check if executing user is an admin
    SELECT role::text, company_id INTO executing_user_role, executing_user_company
    FROM profiles
    WHERE id = auth.uid();

    IF executing_user_role NOT IN ('super_admin', 'company_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can create users';
    END IF;

    -- Ensure company match if company_admin
    IF executing_user_role = 'company_admin' AND executing_user_company != new_company_id THEN
         RAISE EXCEPTION 'Unauthorized: Cannot create user for another company';
    END IF;

    -- OBTENER EL INSTANCE_ID CORRECTO DEL USUARIO QUE EJECUTA
    -- Los usuarios deben estar en la misma instancia
    SELECT instance_id INTO v_instance_id FROM auth.users WHERE id = auth.uid();
    
    -- Si no se encuentra, usar el default (pero esto es raro)
    IF v_instance_id IS NULL THEN
        v_instance_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    -- Create user in auth.users
    INSERT INTO auth.users (
        instance_id, -- Usamos el real
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin
    ) VALUES (
        v_instance_id, -- Usamos el id capturado
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        new_email,
        crypt(new_password, gen_salt('bf')),
        now(),
        now(),
        now(),
        '',
        '',
        '{"provider":"email","providers":["email"], "skip_trigger": true}',
        '{}',
        false
    ) RETURNING id INTO new_user_id;

    -- Create profile
    INSERT INTO public.profiles (id, email, role, company_id, full_name, phone, is_active)
    VALUES (
        new_user_id,
        new_email,
        new_role::app_role,
        new_company_id,
        new_full_name,
        new_phone,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        company_id = EXCLUDED.company_id,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        is_active = EXCLUDED.is_active;

    RETURN new_user_id;
END;
$$;

-- PARTE 2: Reparar usuarios existentes (como dmorales)
DO $$
DECLARE
    v_correct_instance_id uuid;
BEGIN
    -- Obtenemos un instance_id válido de cualquier usuario que ya exista (ej: el super admin)
    SELECT instance_id INTO v_correct_instance_id 
    FROM auth.users 
    LIMIT 1;

    -- Actualizamos usuarios que tengan el instance_id en ceros (que son los rotos)
    IF v_correct_instance_id IS NOT NULL AND v_correct_instance_id != '00000000-0000-0000-0000-000000000000' THEN
        UPDATE auth.users
        SET instance_id = v_correct_instance_id
        WHERE instance_id = '00000000-0000-0000-0000-000000000000';
    END IF;
END $$;

SELECT 'Función corregida y usuarios reparados exitosamente ✅' as mensaje;
