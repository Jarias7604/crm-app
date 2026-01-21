-- 🚀 RESTAURACIÓN DE SEGURIDAD Y PERMISOS (V10 - FINAL CORREGIDO)
-- Corrige el error de columnas (action/subject -> permission_key) y restaura visibilidad.

-- 1. UTILERÍAS DE LECTURA SEGURA (Rápida y sin errores)
CREATE OR REPLACE FUNCTION public.get_auth_company_id() RETURNS uuid AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'company_id', ''))::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.get_auth_role() RETURNS text AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role';
$$ LANGUAGE sql STABLE;

-- 2. LIMPIEZA DE POLÍTICAS VIEJAS O DE EMERGENCIA
DROP POLICY IF EXISTS "emergency_profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "emergency_profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "emergency_companies_read" ON public.companies;
DROP POLICY IF EXISTS "emergency_leads_read" ON public.leads;


-- 3. APLICAR SEGURIDAD SAAS

-- A) VISIBILIDAD DE PERMISOS (Crucial para que la UI funcione)
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissions_read" ON public.role_permissions;
CREATE POLICY "permissions_read" ON public.role_permissions FOR SELECT TO authenticated USING (true); -- Cualquiera puede ver sus propios permisos (filtrado por la app)

ALTER TABLE public.permission_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "definitions_read" ON public.permission_definitions;
CREATE POLICY "definitions_read" ON public.permission_definitions FOR SELECT TO authenticated USING (true);

-- B) PERFILES DE USUARIO (Aislamiento por Empresa)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pf_read" ON public.profiles;
CREATE POLICY "pf_read" ON public.profiles FOR SELECT TO authenticated 
USING (
    company_id = public.get_auth_company_id() OR public.get_auth_role() = 'super_admin'
);
DROP POLICY IF EXISTS "pf_update_self" ON public.profiles;
CREATE POLICY "pf_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- C) EMPRESAS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "co_read" ON public.companies;
CREATE POLICY "co_read" ON public.companies FOR SELECT TO authenticated 
USING (
    id = public.get_auth_company_id() OR public.get_auth_role() = 'super_admin'
);

-- D) LEADS (Datos sensibles)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_isolation" ON public.leads;
CREATE POLICY "leads_isolation" ON public.leads FOR ALL TO authenticated 
USING (
    public.get_auth_role() = 'super_admin' 
    OR (
        company_id = public.get_auth_company_id() 
        AND (
            public.get_auth_role() = 'company_admin' 
            OR assigned_to = auth.uid()
        )
    )
);

-- E) INVITACIONES
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invitations_read" ON public.company_invitations;
CREATE POLICY "invitations_read" ON public.company_invitations FOR SELECT TO authenticated 
USING (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "invitations_manage" ON public.company_invitations;
CREATE POLICY "invitations_manage" ON public.company_invitations FOR ALL TO authenticated 
USING (company_id = public.get_auth_company_id() AND public.get_auth_role() = 'company_admin');


-- 4. INSERTAR DEFINICIONES DE PERMISOS FALTANTES (Corregido)
-- Usamos las columnas correctas: category, permission_key, label
INSERT INTO public.permission_definitions (category, permission_key, label)
VALUES 
    -- Leads
    ('Leads', 'leads_view', 'Ver leads asignados'),
    ('Leads', 'leads_create', 'Crear nuevos leads'),
    ('Leads', 'leads_edit', 'Editar leads existentes'),
    ('Leads', 'leads_delete', 'Eliminar leads'),
    -- Team
    ('Equipo', 'team_view', 'Ver miembros del equipo'),
    ('Equipo', 'team_manage', 'Gestionar usuarios del equipo')
ON CONFLICT (permission_key) DO NOTHING;

SELECT '✅ PERMISOS RESTAURADOS. La pantalla de Roles debería funcionar correctamente.' as status;
