-- ============================================================
-- 🔐 REPARACIÓN DE JERARQUÍA DE PERMISOS (SaaS Logic)
-- ============================================================

-- 1. Asegurar que RLS esté activo en las tablas clave
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

-- 2. Limpieza de políticas previas que permitían ver TODO ("true")
DROP POLICY IF EXISTS "master_leads_policy" ON public.leads;
DROP POLICY IF EXISTS "master_follow_ups_policy" ON public.follow_ups;
DROP POLICY IF EXISTS "leads_hierarchy_policy" ON public.leads;
DROP POLICY IF EXISTS "follow_ups_hierarchy_policy" ON public.follow_ups;

-- 3. POLÍTICA PARA LEADS: 
-- Super Admin: Ve TODO.
-- Admin Empresa: Ve todo lo de SU empresa.
-- Agente: Solo ve leads de SU empresa que tenga ASIGNADOS.
CREATE POLICY "leads_hierarchy_policy" 
ON public.leads FOR ALL 
TO authenticated 
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  OR 
  (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'company_admin' 
    AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  OR 
  (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'sales_agent'
    AND (assigned_to = auth.uid() OR next_followup_assignee = auth.uid())
  )
);

-- 4. POLÍTICA PARA FOLLOW_UPS:
-- Sigue la misma lógica que leads.
CREATE POLICY "follow_ups_hierarchy_policy" 
ON public.follow_ups FOR ALL 
TO authenticated 
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  OR 
  (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'company_admin' 
    AND (SELECT company_id FROM leads WHERE id = lead_id) = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  OR 
  (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'sales_agent'
    AND lead_id IN (SELECT id FROM leads WHERE assigned_to = auth.uid() OR next_followup_assignee = auth.uid())
  )
);

-- 5. Otorgar permisos directos (Grants)
GRANT ALL ON public.leads TO authenticated;
GRANT ALL ON public.follow_ups TO authenticated;

SELECT '✅ Jerarquía de permisos aplicada correctamente' as resultado;
