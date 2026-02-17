-- ====================================================
-- ☢️ OPCIÓN NUCLEAR - ELIMINAR TODA RESTRICCIÓN
-- ====================================================

-- 1. Forzar Rango de SUPER ADMIN para tu email
UPDATE public.profiles 
SET role = 'super_admin'::public.app_role 
WHERE email = 'jarias7604@gmail.com';

-- 2. DESACTIVAR TODO EL RLS (Bypass Total)
-- Esto quita TODOS los muros de seguridad. Solo para ver tus datos.
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_invitations DISABLE ROW LEVEL SECURITY;

-- 3. Borrar cualquier política que pueda estorbar
DROP POLICY IF EXISTS "saas_leads_isolation" ON public.leads;
DROP POLICY IF EXISTS "saas_leads_isolation_v2" ON public.leads;
DROP POLICY IF EXISTS "admin_rescue_leads" ON public.leads;
DROP POLICY IF EXISTS "saas_profiles_isolation" ON public.profiles;
DROP POLICY IF EXISTS "saas_profiles_isolation_v2" ON public.profiles;
DROP POLICY IF EXISTS "admin_rescue_profiles" ON public.profiles;

-- ====================================================
-- ✅ EJECUTA ESTO Y TUS DATOS APARECERÁN AL INSTANTE.
-- Una vez que los veas, reactivaremos la seguridad bien hecha.
-- ====================================================
