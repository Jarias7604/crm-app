-- ====================================================
-- 🚨 REPARACIÓN FINAL DE ACCESO (V2)
-- ====================================================

-- 1. LIMPIEZA DE FUNCIONES PREVIAS (Para evitar el error de retorno)
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;

-- 2. Crear la función con seguridad definer para evitar recursión en RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Asegurar roles para tus dos correos
UPDATE public.profiles 
SET role = 'super_admin'::public.app_role,
    company_id = '00000000-0000-0000-0000-000000000000'
WHERE email = 'jarias7604@gmail.com';

UPDATE public.profiles 
SET role = 'company_admin'::public.app_role,
    company_id = (SELECT id FROM public.companies WHERE id != '00000000-0000-0000-0000-000000000000' LIMIT 1)
WHERE email = 'jarias@ariasdefense.com';

-- 4. RE-APLICAR POLÍTICAS SIN RECURSIÓN
DROP POLICY IF EXISTS "profiles_isolation_strict" ON public.profiles;
CREATE POLICY "profiles_isolation_strict" ON public.profiles
    FOR SELECT
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR 
        public.get_my_role() = 'super_admin'
    );

DROP POLICY IF EXISTS "companies_isolation_strict" ON public.companies;
CREATE POLICY "companies_isolation_strict" ON public.companies
    FOR SELECT
    USING (
        id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR 
        public.get_my_role() = 'super_admin'
    );

-- 5. VERIFICACIÓN FINAL
SELECT email, role, company_id FROM public.profiles WHERE email IN ('jarias7604@gmail.com', 'jarias@ariasdefense.com');
