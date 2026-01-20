-- ====================================================
-- 🔐 MATRIZ DE PERMISOS DINÁMICA (SAAS PRO+)
-- ====================================================

-- 1. Crear tabla de permisos por rol
CREATE TABLE IF NOT EXISTS public.permission_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    permission_key TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role public.app_role NOT NULL,
    permission_key TEXT REFERENCES public.permission_definitions(permission_key) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(role, permission_key)
);

-- 2. Insertar Definiciones de Permisos
INSERT INTO public.permission_definitions (category, permission_key, label) VALUES
('Leads', 'leads_view_all', 'Ver todos los leads de la empresa'),
('Leads', 'leads_view_assigned', 'Ver solo leads asignados'),
('Leads', 'leads_create', 'Crear nuevos leads'),
('Leads', 'leads_edit_any', 'Editar cualquier lead'),
('Leads', 'leads_assign', 'Asignar responsables'),
('Leads', 'leads_delete', 'Eliminar leads'),
('Equipo', 'team_invite', 'Invitar nuevos colaboradores'),
('Equipo', 'team_manage_licenses', 'Gestionar licencias/límites'),
('Equipo', 'team_view_members', 'Ver lista de compañeros'),
('Equipo', 'team_change_roles', 'Cambiar roles de equipo'),
('Configuración', 'config_manage_companies', 'Gestionar empresas clientes'),
('Configuración', 'config_export_reports', 'Exportar informes globales')
ON CONFLICT (permission_key) DO UPDATE SET label = EXCLUDED.label, category = EXCLUDED.category;

-- 3. Sembrar Matriz Actual (Defaults)
DO $$
BEGIN
    -- Super Admin
    INSERT INTO public.role_permissions (role, permission_key, is_enabled) VALUES
    ('super_admin', 'leads_view_all', true),
    ('super_admin', 'team_invite', true),
    ('super_admin', 'team_manage_licenses', true),
    ('super_admin', 'team_view_members', true),
    ('super_admin', 'team_change_roles', true),
    ('super_admin', 'config_manage_companies', true),
    ('super_admin', 'config_export_reports', true)
    ON CONFLICT DO NOTHING;

    -- Company Admin
    INSERT INTO public.role_permissions (role, permission_key, is_enabled) VALUES
    ('company_admin', 'leads_view_all', true),
    ('company_admin', 'leads_view_assigned', true),
    ('company_admin', 'leads_create', true),
    ('company_admin', 'leads_edit_any', true),
    ('company_admin', 'leads_assign', true),
    ('company_admin', 'leads_delete', true),
    ('company_admin', 'team_invite', true),
    ('company_admin', 'team_view_members', true),
    ('company_admin', 'team_change_roles', true),
    ('company_admin', 'config_export_reports', true)
    ON CONFLICT DO NOTHING;

    -- Sales Agent
    INSERT INTO public.role_permissions (role, permission_key, is_enabled) VALUES
    ('sales_agent', 'leads_view_assigned', true),
    ('sales_agent', 'leads_create', true),
    ('sales_agent', 'team_view_members', true)
    ON CONFLICT DO NOTHING;
END $$;

-- 4. RLS para la tabla de permisos
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view definitions" ON public.permission_definitions;
CREATE POLICY "Anyone can view definitions" ON public.permission_definitions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view role permissions" ON public.role_permissions;
CREATE POLICY "Anyone can view role permissions" ON public.role_permissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only Super Admin can edit role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Super Admin can manage role permissions" ON public.role_permissions;
CREATE POLICY "Super Admin can manage role permissions" ON public.role_permissions
    FOR ALL
    TO authenticated
    USING ((SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'super_admin')
    WITH CHECK ((SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'super_admin');
