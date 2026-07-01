-- =================================================================
-- Fix: Cotizaciones visibility when leads are reassigned
-- Problem: cotizaciones_agent_own only allowed seeing quotes with
--          created_by = auth.uid(). After lead reassignment, the new
--          agent (Diana) can't see quotes created by the previous
--          agent (Melvin).
-- Solution: Also allow access when the quote's lead is assigned to
--           the current user (assigned_to = auth.uid()).
-- Date: 2026-06-27
-- =================================================================

DROP POLICY IF EXISTS "cotizaciones_agent_own" ON public.cotizaciones;

CREATE POLICY "cotizaciones_agent_own" ON public.cotizaciones FOR ALL TO authenticated
  USING (
    -- Must be same company (or child company)
    (company_id = public.get_auth_company_id() OR company_id IN (
      SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()
    ))
    AND NOT public.is_company_manager()
    AND (
      -- Original creator always keeps access
      created_by = auth.uid()
      OR
      -- NEW: Agent assigned to the lead also sees its quotes
      lead_id IN (
        SELECT id FROM public.leads
        WHERE assigned_to = auth.uid()
      )
    )
  )
  WITH CHECK (
    (company_id = public.get_auth_company_id() OR company_id IN (
      SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()
    ))
    AND NOT public.is_company_manager()
  );
