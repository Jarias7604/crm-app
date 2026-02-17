-- ====================================================
-- 🏢 AISLAMIENTO DE PLATAFORMA (ESQUEMA SAAS PRO)
-- ====================================================

-- 1. Crear la Empresa del Sistema (Dueños de la Plataforma)
INSERT INTO public.companies (id, name, license_status, max_users)
VALUES (
    '00000000-0000-0000-0000-000000000000', 
    'Arias Defense - Plataforma', 
    'active', 
    100
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 2. Vincular al Super Admin principal con la Empresa del Sistema
UPDATE public.profiles 
SET company_id = '00000000-0000-0000-0000-000000000000',
    role = 'super_admin'
WHERE email = 'jarias7604@gmail.com';

-- 3. REFINAR RLS DE PROFILES PARA AISLAMIENTO TOTAL
-- El objetivo es que nadie vea a gente de otras empresas en su pestaña de "Equipo"
DROP POLICY IF EXISTS "team_profiles_visibility" ON public.profiles;
DROP POLICY IF EXISTS "saas_profiles_isolation" ON public.profiles;
DROP POLICY IF EXISTS "saas_profiles_isolation_v2" ON public.profiles;
DROP POLICY IF EXISTS "profiles_isolation_strict" ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_isolation_strict" ON public.profiles
    FOR SELECT
    USING (
        -- Regla 1: Un usuario ve a sus compañeros de la misma empresa
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR 
        -- Regla 2: El Super Admin puede ver todos los perfiles PARA GESTIÓN (pero no en su lista de equipo local)
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- 4. REFINAR RLS DE COMPANIES
DROP POLICY IF EXISTS "saas_companies_isolation" ON public.companies;
DROP POLICY IF EXISTS "saas_companies_isolation_v2" ON public.companies;
DROP POLICY IF EXISTS "companies_isolation_strict" ON public.companies;

CREATE POLICY "companies_isolation_strict" ON public.companies
    FOR SELECT
    USING (
        id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR 
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- 5. REFINAR RLS DE LEADS (MANTENER PRIVACIDAD)
DROP POLICY IF EXISTS "team_leads_collaboration" ON public.leads;
DROP POLICY IF EXISTS "leads_isolation_strict" ON public.leads;

CREATE POLICY "leads_isolation_strict" ON public.leads
    FOR ALL
    USING (
        CASE 
            -- Super Admin: No ve leads por diseño (privacidad)
            WHEN (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'super_admin' THEN false
            
            -- Admin Empresa: Ve todo lo de su empresa
            WHEN (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'company_admin' THEN
                company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
            
            -- Agente: Ve solo lo asignado
            WHEN (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'sales_agent' THEN
                company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) 
                AND (assigned_to = auth.uid() OR assigned_to IS NULL) -- Opción: también ver no asignados
            
            ELSE false
        END
    );
