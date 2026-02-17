-- Solución Final para Error de Login "Database error querying schema"
-- 1. Eliminamos políticas recursivas que causan el crash
-- 2. Creamos políticas seguras y optimizadas para leer perfiles
-- 3. Reparamos la metadata de usuarios que podrían estar corruptos

-- A. Función auxiliar para romper recursividad infinita
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- B. Limpieza de políticas antiguas en PROFILES
DROP POLICY IF EXISTS "saas_profiles_isolation" ON public.profiles;
DROP POLICY IF EXISTS "saas_profiles_isolation_v2" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_v2" ON public.profiles;
DROP POLICY IF EXISTS "safe_profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "admin_rescue_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_isolation_strict" ON public.profiles;
DROP POLICY IF EXISTS "Profiles visibility" ON public.profiles;
DROP POLICY IF EXISTS "View team members" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_policy" ON public.profiles;
DROP POLICY IF EXISTS "team_profiles_visibility" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_and_team" ON public.profiles;

-- C. Nuevas Políticas SIMPLIFICADAS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Leer mi propio perfil (CRÍTICO para login)
CREATE POLICY "read_own_profile" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- 2. Leer perfiles de mi misma empresa (Usando la función segura)
CREATE POLICY "read_company_profiles" ON public.profiles
    FOR SELECT
    USING (company_id = get_my_company_id());

-- 3. Actualizar mi propio perfil
CREATE POLICY "update_own_profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- D. Reparar Metadata de Usuarios (Específico para dmorales y otros creados por admin)
-- Esto actualiza auth.users copiando datos desde profiles
UPDATE auth.users u
SET raw_app_meta_data = 
    jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email'],
        'role', p.role -- Sincronizar rol
    ),
    raw_user_meta_data = 
    jsonb_build_object(
        'full_name', p.full_name,
        'company_id', p.company_id
    )
FROM public.profiles p
WHERE u.id = p.id
AND (u.raw_app_meta_data->>'role' IS NULL OR u.raw_app_meta_data->>'role' != p.role::text);

SELECT 'Políticas RLS reparadas y metadata sincronizada exitosamente 🚀' as resultado;
