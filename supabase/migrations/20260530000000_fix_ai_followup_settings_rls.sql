-- ================================================================
-- FIX: ai_followup_settings RLS — usar get_auth_company_id()
-- La política antigua usaba auth.uid() directo, rompiendo simulation mode
-- y cualquier contexto donde el company_id del perfil ≠ empresa simulada
-- Aplicado: 2026-05-30
-- ================================================================

DROP POLICY IF EXISTS "Company members can manage their followup settings" ON public.ai_followup_settings;
DROP POLICY IF EXISTS "company_access" ON public.ai_followup_settings;

CREATE POLICY "company_access" ON public.ai_followup_settings
FOR ALL TO authenticated
USING  (company_id = get_auth_company_id())
WITH CHECK (company_id = get_auth_company_id());
