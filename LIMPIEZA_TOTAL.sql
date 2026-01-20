-- ====================================================
-- 🧹 LIMPIEZA TOTAL Y RESTAURACIÓN DE EMERGENCIA
-- ====================================================

-- 1. Te devolvemos el Rango de SUPER ADMIN
UPDATE public.profiles 
SET role = 'super_admin'::public.app_role 
WHERE email = 'jarias7604@gmail.com';

-- 2. BORRAR TODAS LAS POLÍTICAS CREADAS RECIENTEMENTE (Limpieza)
-- Borrar de LEADS
DROP POLICY IF EXISTS "saas_leads_isolation" ON public.leads;
DROP POLICY IF EXISTS "saas_leads_isolation_v2" ON public.leads;
DROP POLICY IF EXISTS "leads_read_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_all_v2" ON public.leads;

-- Borrar de PROFILES
DROP POLICY IF EXISTS "saas_profiles_isolation" ON public.profiles;
DROP POLICY IF EXISTS "saas_profiles_isolation_v2" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_v2" ON public.profiles;
DROP POLICY IF EXISTS "safe_profiles_select" ON public.profiles;

-- Borrar de COMPANIES
DROP POLICY IF EXISTS "saas_companies_isolation" ON public.companies;
DROP POLICY IF EXISTS "saas_companies_isolation_v2" ON public.companies;
DROP POLICY IF EXISTS "companies_read_policy" ON public.companies;
DROP POLICY IF EXISTS "super_admin_manage_companies" ON public.companies;

-- 3. CREAR UNA POLÍTICA SIMPLE QUE TE PERMITA VER TODO (Modo Rescate)
CREATE POLICY "admin_rescue_leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "admin_rescue_profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "admin_rescue_companies" ON public.companies FOR SELECT USING (true);

-- 4. LIMPIAR FUNCIONES SI EXISTEN
DROP FUNCTION IF EXISTS public.get_company_user_count(UUID);
DROP FUNCTION IF EXISTS public.check_can_add_user(UUID);

-- ====================================================
-- ✅ AL TERMINAR ESTO, VERÁS TUS DATOS DE NUEVO.
-- No has perdido nada, solo hemos quitado los bloqueos.
-- ====================================================
