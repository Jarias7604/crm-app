-- ====================================================
-- ☢️ SCRIPT DE FUERZA BRUTA (PARA RECUPERAR TODO)
-- ====================================================

-- 1. DESACTIVAR LA SEGURIDAD (RLS) TEMPORALMENTE
-- Esto hará que los datos aparezcan de inmediato si el problema es RLS
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_invitations DISABLE ROW LEVEL SECURITY;

-- 2. LIMPIAR CUALQUIER FUNCIÓN QUE BLOQUEE
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
DROP FUNCTION IF EXISTS public.check_is_super_admin() CASCADE;

-- 3. FORZAR ROLES A NIVEL DE BASE DE DATOS
-- Aseguramos que los perfiles existan y tengan el rol correcto
INSERT INTO public.profiles (id, email, role, company_id)
SELECT id, email, 'super_admin', '00000000-0000-0000-0000-000000000000'
FROM auth.users
WHERE LOWER(email) = LOWER('jarias7604@gmail.com')
ON CONFLICT (id) DO UPDATE 
SET role = 'super_admin'::public.app_role, 
    company_id = '00000000-0000-0000-0000-000000000000';

INSERT INTO public.profiles (id, email, role, company_id)
SELECT id, email, 'company_admin', (SELECT id FROM public.companies WHERE id != '00000000-0000-0000-0000-000000000000' LIMIT 1)
FROM auth.users
WHERE LOWER(email) = LOWER('jarias@ariasdefense.com')
ON CONFLICT (id) DO UPDATE 
SET role = 'company_admin'::public.app_role,
    company_id = (SELECT id FROM public.companies WHERE id != '00000000-0000-0000-0000-000000000000' LIMIT 1);

-- 4. VERIFICACIÓN CRÍTICA
-- Si esta tabla sale vacía, es que no hemos encontrado esos correos en el Auth de Supabase
SELECT 'PERFILES CARGADOS' as status, id, email, role, company_id 
FROM public.profiles 
WHERE LOWER(email) IN (LOWER('jarias7604@gmail.com'), LOWER('jarias@ariasdefense.com'));
