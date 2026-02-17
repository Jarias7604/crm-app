-- ================================================================
-- 🆘 SCRIPT DE RESTAURACIÓN DE EMERGENCIA (V50)
-- ESTADO: 11 de Febrero 2026 - 15:05
-- ================================================================

DO $$ 
BEGIN
    -- 1. Limpiar funciones conflictivas
    DROP FUNCTION IF EXISTS public.check_is_super_admin() CASCADE;

    -- 2. Restaurar función original get_auth_role (La versión que funciona sin saltarse RLS)
    CREATE OR REPLACE FUNCTION public.get_auth_role()
    RETURNS public.app_role AS $f$
    BEGIN
      RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
    END;
    $f$ LANGUAGE plpgsql STABLE;

    -- 3. Asegurar que las tablas tengan RLS pero con políticas permisivas (Estado V50)
    
    -- LEADS
    ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow All" ON public.leads;
    CREATE POLICY "Allow All" ON public.leads FOR ALL USING (true);

    -- COMPANIES
    ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow All" ON public.companies;
    CREATE POLICY "Allow All" ON public.companies FOR ALL USING (true);

    -- PROFILES
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "super_admin_manage_all" ON public.profiles;
    DROP POLICY IF EXISTS "view_own_profile" ON public.profiles;
    DROP POLICY IF EXISTS "user_update_self" ON public.profiles;
    
    CREATE POLICY "super_admin_manage_all" ON public.profiles FOR ALL USING (get_auth_role() = 'super_admin'::app_role);
    CREATE POLICY "view_own_profile" ON public.profiles FOR SELECT USING (id = auth.uid());
    CREATE POLICY "user_update_self" ON public.profiles FOR UPDATE USING (id = auth.uid());

END $$;
