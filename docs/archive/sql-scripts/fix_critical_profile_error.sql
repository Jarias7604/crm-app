-- INSTRUCCIONES CRÍTICAS:
-- 1. Ve al "SQL Editor" de Supabase.
-- 2. Copia y pega TODO este bloque de código.
-- 3. IMPORTANTE: Cambia 'jarias7604@gmail.com' por tu correo real en la línea de abajo.
-- 4. Dale clic a "Run".

DO $$
DECLARE
    -- 👇👇👇 CAMBIA ESTE CORREO POR EL TUYO 👇👇👇
    target_email TEXT := 'jarias7604@gmail.com'; 
    
    v_user_id UUID;
    v_company_id UUID;
BEGIN
    -- 1. Buscar el ID del usuario en la tabla de autenticación (auth.users)
    SELECT id INTO v_user_id FROM auth.users WHERE email = target_email;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '❌ ERROR: No se encontró ningún usuario registrado con el email: %. Verifica que el correo esté bien escrito.', target_email;
    END IF;

    -- 2. Asegurar que existe al menos una empresa (si no, crearla)
    -- Intentamos buscar una existente primero
    SELECT id INTO v_company_id FROM public.companies LIMIT 1;
    
    IF v_company_id IS NULL THEN
        INSERT INTO public.companies (name, license_status)
        VALUES ('Mi Empresa CRM', 'active')
        RETURNING id INTO v_company_id;
    END IF;

    -- 3. Insertar (o recuperar) el perfil en public.profiles
    -- Esto arregla el error "Profile not found"
    INSERT INTO public.profiles (id, email, role, company_id, status)
    VALUES (v_user_id, target_email, 'super_admin', v_company_id, 'active')
    ON CONFLICT (id) DO UPDATE
    SET 
        role = 'super_admin',
        company_id = v_company_id,
        status = 'active';

    -- 4. Asegurarnos que la tabla leads tiene las columnas nuevas
    -- (Por si el script anterior no se ejecutó)
    BEGIN
        ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_name text;
        ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS value numeric DEFAULT 0;
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'Columnas ya existen, ignorando.';
    END;

    RAISE NOTICE '✅ ÉXITO: Perfil de % reparado y vinculado a la empresa %', target_email, v_company_id;
END $$;
