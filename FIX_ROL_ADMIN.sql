-- ==========================================
-- 🛠️ ASIGNAR ROL DE ADMIN AL NUEVO CORREO
-- ==========================================

-- 1. Convertir a este usuario en ADMIN DE EMPRESA
UPDATE public.profiles 
SET role = 'company_admin'::public.app_role 
WHERE email = 'jarias@ariasdefense.com';

-- 2. Asegurarnos que tenga una empresa asignada (si no tiene)
UPDATE public.profiles
SET company_id = (SELECT id FROM public.companies LIMIT 1)
WHERE email = 'jarias@ariasdefense.com' AND company_id IS NULL;

-- ==========================================
-- ✅ INSTRUCCIONES:
-- 1. Ejecuta este código en Supabase.
-- 2. CIERRA SESIÓN y vuelve a entrar en la web.
-- 3. Verás que ahora dice "ADMIN EMPRESA" y aparecerá "Equipo".
-- ==========================================
