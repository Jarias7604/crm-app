-- INSTRUCCIONES:
-- 1. Ve a https://supabase.com/dashboard/project/ikofyypxphrqkncimszt/sql
-- 2. Copia y pega el siguiente código.
-- 3. REEMPLAZA 'TU_EMAIL_AQUI' con el correo con el que te registraste.
-- 4. Dale clic a "Run".

UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'jarias7604@gmail.com';

-- Verificación (Opcional):
-- SELECT * FROM public.profiles WHERE role = 'super_admin';
