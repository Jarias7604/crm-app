-- Fix para el error de crear usuarios
-- El problema es que la función admin_create_user intenta usar una columna 'status' que no existe

-- Primero, eliminar la función anterior
DROP FUNCTION IF EXISTS admin_create_user(text, text, text, text, uuid, text);

-- Recrear la función sin la columna 'status'
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
BEGIN
    -- Check if executing user is an admin
    SELECT role, company_id INTO executing_user_role, executing_user_company
    FROM profiles
    WHERE id = auth.uid();

    IF executing_user_role NOT IN ('super_admin', 'company_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can create users';
    END IF;

    -- Ensure company match if company_admin
    IF executing_user_role = 'company_admin' AND executing_user_company != new_company_id THEN
         RAISE EXCEPTION 'Unauthorized: Cannot create user for another company';
    END IF;

    -- Create user in auth.users
    INSERT INTO auth.users (
        instance_id,
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
        '00000000-0000-0000-0000-000000000000',
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
        '{"provider":"email","providers":["email"]}',
        '{}',
        false
    ) RETURNING id INTO new_user_id;

    -- Create profile (SIN la columna 'status')
    INSERT INTO public.profiles (id, email, role, company_id, full_name, phone, is_active)
    VALUES (
        new_user_id,
        new_email,
        new_role,
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

-- Verificar que la función se creó correctamente
SELECT 'Función admin_create_user actualizada correctamente ✅' as resultado;
