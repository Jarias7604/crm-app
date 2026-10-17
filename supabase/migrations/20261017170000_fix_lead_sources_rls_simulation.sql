-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Permitir lectura de lead_sources en modo simulación y super_admin
-- Fecha: 2026-10-17
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS lead_sources_company_isolation ON public.lead_sources;
CREATE POLICY lead_sources_company_isolation ON public.lead_sources
    FOR ALL
    TO authenticated
    USING (
        company_id = public.get_auth_company_id()
        OR company_id = '00000000-0000-0000-0000-000000000000'
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    )
    WITH CHECK (
        company_id = public.get_auth_company_id()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    );
