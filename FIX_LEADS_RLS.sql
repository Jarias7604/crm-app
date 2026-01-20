-- EJECUTAR EN SUPABASE SQL EDITOR
-- Esto arregla los permisos de lectura de leads

-- 1. Verificar si hay leads en la tabla
SELECT 'Total leads en BD:' as info, count(*) as total FROM public.leads;

-- 2. Verificar RLS está habilitado
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'leads';

-- 3. Recrear políticas de leads para que funcionen correctamente
DROP POLICY IF EXISTS "Users can view leads from their company" ON public.leads;
DROP POLICY IF EXISTS "Users can insert leads for their company" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads from their company" ON public.leads;

-- Política para VER leads (SELECT)
CREATE POLICY "Users can view leads from their company"
ON public.leads FOR SELECT
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- Política para CREAR leads (INSERT)
CREATE POLICY "Users can insert leads for their company"
ON public.leads FOR INSERT
TO authenticated
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- Política para ACTUALIZAR leads (UPDATE)
CREATE POLICY "Users can update leads from their company"
ON public.leads FOR UPDATE
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- 4. Verificar que el perfil actual tiene company_id
SELECT 'Tu perfil:' as info, id, email, company_id, role FROM public.profiles WHERE id = auth.uid();

-- 5. Verificar leads de tu company
SELECT 'Leads de tu empresa:' as info, count(*) as total 
FROM public.leads 
WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid());
