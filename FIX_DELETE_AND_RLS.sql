-- ============================================================
-- 🚀 REPARACIÓN DE ELIMINACIÓN Y SEGURIDAD (RLS)
-- ============================================================

-- 1. Habilitar ELIMINACIÓN EN CASCADA
-- Esto permite que al borrar un Lead, sus seguimientos se borren automáticamente.
ALTER TABLE public.follow_ups 
DROP CONSTRAINT IF EXISTS follow_ups_lead_id_fkey,
ADD CONSTRAINT follow_ups_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

-- 2. Política Maestra de Leads (Lectura, Inserción, Actualización y Borrado)
-- Asegura que todos los miembros autenticados puedan operar sobre los leads.
DROP POLICY IF EXISTS "Admins can do everything with leads" ON public.leads;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.leads;
DROP POLICY IF EXISTS "Users can view their own company leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;

CREATE POLICY "master_leads_policy" 
ON public.leads FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 3. Otorgar permisos directos
GRANT ALL ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

SELECT '✅ Sistema de eliminación y leads REPARADO' as resultado;
