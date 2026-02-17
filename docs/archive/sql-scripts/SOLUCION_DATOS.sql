-- ==========================================
-- 🛠️ SCRIPT DE SOLUCIÓN DEFINITIVA (V3)
-- ==========================================

-- 1. LIMPIEZA DE FUNCIONES Y POLÍTICAS ANTERIORES
DROP FUNCTION IF EXISTS public.check_is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_company_id() CASCADE;

-- 2. CREAR FUNCIONES DE SEGURIDAD (SECURITY DEFINER)
-- Estas funciones saltan el RLS para poder consultar roles sin bucles.
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role::text = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT company_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REPARAR POLÍTICAS (Evitando recursión infinita)
-- Primero eliminamos todas las políticas viejas de estas tablas
DROP POLICY IF EXISTS "Profiles visibility" ON public.profiles;
DROP POLICY IF EXISTS "View team members" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_v2" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_policy" ON public.profiles;
DROP POLICY IF EXISTS "leads_read_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_select_v2" ON public.leads;
DROP POLICY IF EXISTS "leads_all_v2" ON public.leads;
DROP POLICY IF EXISTS "Users can view own company leads" ON public.leads;

-- Aplicamos nuevas políticas usando las funciones de arriba
CREATE POLICY "safe_profiles_select" ON public.profiles
    FOR SELECT USING (id = auth.uid() OR check_is_super_admin() OR company_id = get_my_company_id());

CREATE POLICY "safe_leads_select" ON public.leads
    FOR SELECT USING (check_is_super_admin() OR company_id = get_my_company_id());

CREATE POLICY "safe_leads_all" ON public.leads
    FOR ALL USING (check_is_super_admin() OR company_id = get_my_company_id());

-- 4. RESTAURAR TU ACCESO (MUY IMPORTANTE)
-- Forzamos que tu correo sea Super Admin. 
-- Usamos casting ::text para evitar el error de ENUM.
UPDATE public.profiles 
SET role = 'super_admin'::public.app_role, status = 'active'
WHERE email = 'jarias7604@gmail.com';

-- 5. ASEGURAR RLS ACTIVADO
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;
