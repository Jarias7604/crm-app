-- ====================================================
-- 🚨 REPARACIÓN MAESTRA (SIN RECURSIÓN)
-- ====================================================

-- 1. DESACTIVAR RLS TEMPORALMENTE PARA LIMPIAR
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;

-- 2. LIMPIEZA DE FUNCIONES EN CONFLICTO
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;

-- 3. CREAR FUNCIÓN DE APOYO (SECURITY DEFINER es CLAVE para evitar bucles)
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ASEGURAR EMPRESA DEL SISTEMA
INSERT INTO public.companies (id, name, max_users)
VALUES ('00000000-0000-0000-0000-000000000000', 'Sistema Arias Defense', 100)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 5. FORZAR ROLES (Ignorando mayúsculas/minúsculas)
UPDATE public.profiles 
SET role = 'super_admin'::public.app_role,
    company_id = '00000000-0000-0000-0000-000000000000'
WHERE LOWER(email) = LOWER('jarias7604@gmail.com');

UPDATE public.profiles 
SET role = 'company_admin'::public.app_role,
    company_id = (SELECT id FROM public.companies WHERE id != '00000000-0000-0000-0000-000000000000' LIMIT 1)
WHERE LOWER(email) = LOWER('jarias@ariasdefense.com');

-- 6. RE-ACTIVAR RLS CON POLÍTICAS SIMPLIFICADAS (SIN RECURSIÓN)
-- Política de Perfiles: Un usuario siempre puede ver su propio perfil
DROP POLICY IF EXISTS "profiles_self_and_team" ON public.profiles;
CREATE POLICY "profiles_self_and_team" ON public.profiles
    FOR SELECT USING (
        id = auth.uid() -- Siempre veo mi propio perfil
        OR 
        company_id = (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1) -- Veo mi equipo
        OR 
        public.check_is_super_admin() -- El super admin ve todo
    );

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política de Leads: 
DROP POLICY IF EXISTS "leads_access_v3" ON public.leads;
CREATE POLICY "leads_access_v3" ON public.leads
    FOR ALL USING (
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'company_admin' 
        AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR 
        assigned_to = auth.uid()
        OR 
        public.check_is_super_admin()
    );

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 7. SOLUCIÓN AL PROBLEMA DE "TODO SALE COLABORADOR"
-- Si por alguna razón el trigger de auth no creó el perfil, lo creamos ahora
INSERT INTO public.profiles (id, email, role, company_id)
SELECT id, email, 'super_admin', '00000000-0000-0000-0000-000000000000'
FROM auth.users
WHERE email = 'jarias7604@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- 8. VERIFICACIÓN FINAL (Muestra el resultado abajo)
SELECT id, email, role, company_id FROM public.profiles 
WHERE email IN ('jarias7604@gmail.com', 'jarias@ariasdefense.com');
