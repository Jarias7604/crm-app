-- ==========================================
-- 🤝 TEAM COLLABORATION & LEAD ASSIGNMENT
-- ==========================================

-- 1. Asegurar columna de asignación
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id);

-- 2. REFINAR RLS DE LEADS PARA COLABORACIÓN
-- Eliminamos políticas previas para evitar conflictos
DROP POLICY IF EXISTS "saas_leads_isolation" ON public.leads;
DROP POLICY IF EXISTS "saas_leads_isolation_v2" ON public.leads;
DROP POLICY IF EXISTS "admin_rescue_leads" ON public.leads;
DROP POLICY IF EXISTS "team_leads_collaboration" ON public.leads;

-- ACTIVAR RLS (por si se desactivó en el paso NUCLEAR)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_leads_collaboration" ON public.leads
    FOR ALL
    USING (
        CASE 
            -- 1. Company Admin: Ve TODO lo de su empresa
            WHEN (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'company_admin' THEN
                company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
            
            -- 2. Sales Agent: Ve solo lo ASIGNADO a él (y de su empresa)
            WHEN (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'sales_agent' THEN
                company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) 
                AND assigned_to = auth.uid()
            
            -- 3. Super Admin: NO VE LEADS (Privacidad SaaS)
            ELSE false
        END
    )
    WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

-- 3. REFINAR RLS DE PROFILES (Para que agentes vean a sus compañeros)
DROP POLICY IF EXISTS "saas_profiles_isolation" ON public.profiles;
DROP POLICY IF EXISTS "saas_profiles_isolation_v2" ON public.profiles;
DROP POLICY IF EXISTS "admin_rescue_profiles" ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_profiles_visibility" ON public.profiles
    FOR SELECT
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR 
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    );
