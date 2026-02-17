-- Solución definitiva para el error de creación de usuarios
-- 1. Corregimos el Trigger para que NO falle por columnas inexistentes
-- 2. Corregimos admin_create_user para que avise al trigger que no debe hacer nada

-- PARTE 1: Actualizar el Trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
    v_role TEXT;
    v_invitation RECORD;
BEGIN
    -- NUEVO: Si el usuario fue creado por el Admin (tiene skip_trigger), SALIR INMEDIATAMENTE
    IF new.raw_app_meta_data->>'skip_trigger' = 'true' THEN
        RETURN new;
    END IF;

    -- Check for valid pending invitation
    SELECT * INTO v_invitation 
    FROM public.company_invitations 
    WHERE email = new.email 
    AND status = 'pending'
    LIMIT 1;

    IF v_invitation IS NOT NULL THEN
        -- SCENARIO A: User was invited. Join existing company.
        v_company_id := v_invitation.company_id;
        v_role := v_invitation.role;
        
        -- Mark invitation as accepted
        UPDATE public.company_invitations 
        SET status = 'accepted' 
        WHERE id = v_invitation.id;
        
        -- Create Profile linked to existing company
        -- CORRECCIÓN: Usar is_active en lugar de status
        INSERT INTO public.profiles (id, email, role, company_id, is_active)
        VALUES (
            new.id, 
            new.email, 
            v_role, 
            v_company_id, 
            true -- is_active true
        );
        
    ELSE
        -- SCENARIO B: No invitation. Create new company (Self Signup).
        -- Create a new company for this user
        -- CORRECCIÓN: Eliminada columna status, usar is_active si existe o default
        INSERT INTO public.companies (name)
        VALUES (
            COALESCE(new.raw_user_meta_data->>'company_name', 'Mi Empresa')
        )
        RETURNING id INTO v_company_id;
        
        -- Create Profile linked to NEW company as Admin
        -- CORRECCIÓN: Usar is_active en lugar de status
        INSERT INTO public.profiles (id, email, role, company_id, is_active)
        VALUES (
            new.id, 
            new.email, 
            'company_admin', 
            v_company_id, 
            true
        );
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- PARTE 2: Actualizar la función admin_create_user para usar skip_trigger
DROP FUNCTION IF EXISTS admin_create_user(text, text, text, text, uuid, text);

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

    -- Create user in auth.users WITH skip_trigger FLAG
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
        '{"provider":"email","providers":["email"], "skip_trigger": true}', -- AQUÍ ESTÁ LA CLAVE
        '{}',
        false
    ) RETURNING id INTO new_user_id;

    -- Create profile (without 'status' column)
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

SELECT 'Fix completo aplicado correctamente! Intenta crear el usuario de nuevo.' as mensaje;
