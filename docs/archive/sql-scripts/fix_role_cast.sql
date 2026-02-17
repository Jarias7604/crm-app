-- Solución para error de tipo de ROL (text vs app_role)
-- Hacemos cast explícito ::app_role donde sea necesario

-- 1. Actualizar handle_new_user con casts
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
    v_role TEXT;
    v_invitation RECORD;
BEGIN
    -- Skip trigger if created by admin
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
        -- SCENARIO A: User was invited.
        v_company_id := v_invitation.company_id;
        v_role := v_invitation.role;
        
        -- Mark invitation as accepted
        UPDATE public.company_invitations 
        SET status = 'accepted' 
        WHERE id = v_invitation.id;
        
        -- Create Profile
        INSERT INTO public.profiles (id, email, role, company_id, is_active)
        VALUES (
            new.id, 
            new.email, 
            v_role::app_role, -- CAST IMPORTANTE
            v_company_id, 
            true
        );
        
    ELSE
        -- SCENARIO B: Self Signup.
        INSERT INTO public.companies (name)
        VALUES (
            COALESCE(new.raw_user_meta_data->>'company_name', 'Mi Empresa')
        )
        RETURNING id INTO v_company_id;
        
        -- Create Profile
        INSERT INTO public.profiles (id, email, role, company_id, is_active)
        VALUES (
            new.id, 
            new.email, 
            'company_admin'::app_role, -- CAST IMPORTANTE
            v_company_id, 
            true
        );
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Actualizar admin_create_user con casts
DROP FUNCTION IF EXISTS admin_create_user(text, text, text, text, uuid, text);

CREATE OR REPLACE FUNCTION admin_create_user(
    new_email text,
    new_password text,
    new_role text, -- Recibimos texto desde el frontend
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
    executing_user_role text; -- Lo mantenemos como text para comparar
    executing_user_company uuid;
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
        '{"provider":"email","providers":["email"], "skip_trigger": true}',
        '{}',
        false
    ) RETURNING id INTO new_user_id;

    -- Create profile
    INSERT INTO public.profiles (id, email, role, company_id, full_name, phone, is_active)
    VALUES (
        new_user_id,
        new_email,
        new_role::app_role, -- CAST IMPORTANTE: Convertimos el texto al enum app_role
        new_company_id,
        new_full_name,
        new_phone,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role, -- Postgres maneja el tipo aqui automáticamente
        company_id = EXCLUDED.company_id,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        is_active = EXCLUDED.is_active;

    RETURN new_user_id;
END;
$$;

SELECT 'Tipos de rol corregidos (::app_role) exitosamente ✅' as mensaje;
