-- INSTRUCCIONES:
-- 1. Ve al Editor SQL de Supabase.
-- 2. Reemplaza 'TU_EMAIL_DE_LOGIN_AQUI' con tu correo de inicio de sesión (ej: jarias7604@gmail.com).
-- 3. Ejecuta el script.

-- 1. Asegurar que existe al menos una empresa
INSERT INTO public.companies (name, license_status)
VALUES ('Empresa Admin', 'active');

-- 2. Asignar esa empresa a tu usuario si no tiene una
UPDATE public.profiles
SET company_id = (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
WHERE email = 'TU_EMAIL_DE_LOGIN_AQUI' 
  AND company_id IS NULL;

-- 3. Verificar
SELECT email, company_id, role FROM public.profiles WHERE email = 'TU_EMAIL_DE_LOGIN_AQUI';
