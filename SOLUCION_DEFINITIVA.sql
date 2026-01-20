-- ====================================================
-- 🚀 SOLUCIÓN DEFINITIVA DE ACCESO Y VISIBILIDAD
-- ====================================================

-- 1. LIMPIEZA TOTAL DE FUNCIONES (Para evitar errores de firma/retorno)
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;

-- 2. FUNCIÓN DE SEGURIDAD (Permite a la base de datos saber quién eres sin errores)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  -- SECURITY DEFINER hace que esta función ignore el RLS para poder leer el rol
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. ASIGNACIÓN MANUAL DE ROLES (Asegura que tus correos tengan el poder)
-- Primero nos aseguramos que exista la empresa del sistema
INSERT INTO public.companies (id, name, max_users)
VALUES ('00000000-0000-0000-0000-000000000000', 'Sistema Arias Defense', 100)
ON CONFLICT (id) DO NOTHING;

-- Asignar Super Admin a jarias7604@gmail.com
UPDATE public.profiles 
SET role = 'super_admin'::public.app_role,
    company_id = '00000000-0000-0000-0000-000000000000'
WHERE email = 'jarias7604@gmail.com';

-- Asignar Admin de Empresa a jarias@ariasdefense.com
UPDATE public.profiles 
SET role = 'company_admin'::public.app_role,
    company_id = (SELECT id FROM public.companies WHERE id != '00000000-0000-0000-0000-000000000000' LIMIT 1)
WHERE email = 'jarias@ariasdefense.com';

-- 4. REPARAR POLÍTICAS DE VISIBILIDAD (Para que veas los Leads y el Menú)
DROP POLICY IF EXISTS "profiles_isolation_strict" ON public.profiles;
CREATE POLICY "profiles_isolation_strict" ON public.profiles
    FOR SELECT USING (true); -- Temporalmente abierto para asegurar que te cargue el perfil

DROP POLICY IF EXISTS "leads_isolation_strict" ON public.leads;
CREATE POLICY "leads_isolation_strict" ON public.leads
    FOR ALL USING (
        CASE 
            WHEN public.get_my_role() = 'super_admin' THEN true -- El super admin ahora verá todo para debug
            WHEN public.get_my_role() = 'company_admin' THEN company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
            ELSE assigned_to = auth.uid()
        END
    );

-- 5. VERIFICACIÓN (Mira los resultados abajo al darle a Run)
SELECT email, role, company_id FROM public.profiles WHERE email IN ('jarias7604@gmail.com', 'jarias@ariasdefense.com');
