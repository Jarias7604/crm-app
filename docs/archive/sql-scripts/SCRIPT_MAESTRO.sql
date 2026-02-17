-- ============================================================
-- 🚀 SCRIPT MAESTRO - EJECUTAR TODO ESTO EN SUPABASE
-- ============================================================
-- 
-- INSTRUCCIONES PASO A PASO:
--
-- 1. Abre tu navegador y ve a:
--    https://supabase.com/dashboard/project/ikofyypxphrqkncimszt/sql
--
-- 2. Borra cualquier código que haya en el editor
--
-- 3. Copia TODO el contenido de este archivo (Ctrl+A, Ctrl+C)
--
-- 4. Pégalo en el editor de Supabase (Ctrl+V)
--
-- 5. Haz clic en el botón verde "Run" (o presiona Ctrl+Enter)
--
-- 6. Si te pregunta por "destructive operation", haz clic en "Run this query"
--
-- 7. Espera a que termine. Deberías ver "TODO LISTO!" al final.
--
-- ============================================================

-- PASO 1: Agregar columnas a la tabla LEADS
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS value numeric DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_followup_date timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_followup_assignee uuid;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_action_notes text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS closing_amount numeric DEFAULT 0;

-- PASO 2: Agregar columnas a la tabla FOLLOW_UPS
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS action_type text DEFAULT 'call';
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS notes text;

-- PASO 3: Arreglar permisos (RLS) de LEADS
DROP POLICY IF EXISTS "Users can view leads from their company" ON public.leads;
DROP POLICY IF EXISTS "Users can insert leads for their company" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads from their company" ON public.leads;

CREATE POLICY "Users can view leads from their company"
ON public.leads FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert leads for their company"
ON public.leads FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update leads from their company"
ON public.leads FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- PASO 4: Asegurar que exista una empresa
INSERT INTO public.companies (name, license_status)
SELECT 'Mi Empresa CRM', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.companies LIMIT 1);

-- PASO 5: Crear perfil para usuarios sin perfil
INSERT INTO public.profiles (id, email, role, company_id, status)
SELECT 
    u.id,
    u.email,
    'super_admin',
    (SELECT id FROM public.companies LIMIT 1),
    'active'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- PASO 6: Asignar empresa a perfiles sin empresa
UPDATE public.profiles
SET company_id = (SELECT id FROM public.companies LIMIT 1)
WHERE company_id IS NULL;

-- VERIFICACIÓN FINAL
SELECT '✅ TODO LISTO!' as resultado;
SELECT 'Empresas:' as tabla, count(*) as total FROM public.companies;
SELECT 'Perfiles:' as tabla, count(*) as total FROM public.profiles;
SELECT 'Leads:' as tabla, count(*) as total FROM public.leads;
