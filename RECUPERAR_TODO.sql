-- ==========================================
-- 🆘 S.O.S - RESTAURAR VISIBILIDAD DE DATOS
-- ==========================================

-- 1. Asegurar que el usuario principal es SUPER ADMIN
UPDATE public.profiles 
SET role = 'super_admin'::public.app_role 
WHERE email = 'jarias7604@gmail.com';

-- 2. BYPASS TEMPORAL DE RLS (Para verificar que tus datos están ahí)
-- Esto permitirá que el Super Admin vea TODO temporalmente para tu tranquilidad.
DROP POLICY IF EXISTS "saas_leads_isolation" ON public.leads;
DROP POLICY IF EXISTS "saas_leads_isolation_v2" ON public.leads;

CREATE POLICY "saas_leads_isolation_v2" ON public.leads
    FOR ALL
    USING (
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
        OR
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
        OR
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

-- 3. Verificar perfiles y empresas
DROP POLICY IF EXISTS "saas_profiles_isolation" ON public.profiles;
CREATE POLICY "saas_profiles_isolation_v2" ON public.profiles
    FOR SELECT USING (true); -- Permitir ver todos temporalmente

DROP POLICY IF EXISTS "saas_companies_isolation" ON public.companies;
CREATE POLICY "saas_companies_isolation_v2" ON public.companies
    FOR SELECT USING (true); -- Permitir ver todas temporalmente
