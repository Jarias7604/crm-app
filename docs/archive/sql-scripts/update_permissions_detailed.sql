-- Comprehensive Permissions Update
-- This migration updates the permissions system with detailed granular permissions

-- First, truncate existing permissions to start fresh
TRUNCATE TABLE permission_definitions CASCADE;

-- ==========================================
-- CONFIGURACIÓN (Configuration)
-- ==========================================
INSERT INTO permission_definitions (category, permission_key, label) VALUES
-- Empresas (Companies)
('Configuración', 'companies_view', 'Ver lista de empresas'),
('Configuración', 'companies_create', 'Crear nuevas empresas'),
('Configuración', 'companies_edit', 'Editar empresas existentes'),
('Configuración', 'companies_delete', 'Eliminar empresas'),
('Configuración', 'companies_manage_licenses', 'Gestionar licencias y límites'),

-- Informes (Reports)
('Configuración', 'reports_export_global', 'Exportar informes globales del sistema'),
('Configuración', 'reports_export_company', 'Exportar informes de la empresa');

-- ==========================================
-- EQUIPO (Team Management)
-- ==========================================
INSERT INTO permission_definitions (category, permission_key, label) VALUES
-- Ver equipo
('Equipo', 'team_view_all', 'Ver lista completa del equipo'),
('Equipo', 'team_view_assigned', 'Ver solo miembros asignados'),

-- Crear miembros
('Equipo', 'team_create_members', 'Crear nuevos miembros directamente'),
('Equipo', 'team_invite_members', 'Invitar nuevos colaboradores'),

-- Editar miembros
('Equipo', 'team_edit_members', 'Editar información de miembros'),
('Equipo', 'team_edit_roles', 'Cambiar roles de miembros'),
('Equipo', 'team_toggle_status', 'Activar/Desactivar miembros'),

-- Eliminar miembros
('Equipo', 'team_delete_members', 'Eliminar miembros del equipo'),

-- Gestión de licencias
('Equipo', 'team_manage_limits', 'Gestionar límites de usuarios');

-- ==========================================
-- LEADS (Lead Management)
-- ==========================================
INSERT INTO permission_definitions (category, permission_key, label) VALUES
-- Ver leads
('Leads', 'leads_view_all', 'Ver todos los leads de la empresa'),
('Leads', 'leads_view_assigned', 'Ver solo leads asignados a mí'),

-- Crear leads
('Leads', 'leads_create', 'Crear nuevos leads'),
('Leads', 'leads_import_csv', 'Importar leads vía CSV'),

-- Editar leads
('Leads', 'leads_edit_own', 'Editar mis leads asignados'),
('Leads', 'leads_edit_all', 'Editar cualquier lead de la empresa'),
('Leads', 'leads_reassign', 'Reasignar leads a otros miembros'),
('Leads', 'leads_change_status', 'Cambiar estado de leads'),
('Leads', 'leads_change_priority', 'Cambiar prioridad de leads'),

-- Eliminar leads
('Leads', 'leads_delete_own', 'Eliminar mis propios leads'),
('Leads', 'leads_delete_all', 'Eliminar cualquier lead'),

-- Documentos
('Leads', 'leads_upload_docs', 'Subir documentos a leads'),
('Leads', 'leads_view_docs', 'Ver documentos de leads'),
('Leads', 'leads_delete_docs', 'Eliminar documentos de leads'),

-- Exportar
('Leads', 'leads_export_csv', 'Exportar leads a CSV');

-- ==========================================
-- SEGUIMIENTOS (Follow-ups)
-- ==========================================
INSERT INTO permission_definitions (category, permission_key, label) VALUES
-- Ver seguimientos
('Seguimientos', 'followups_view_own', 'Ver historial de mis seguimientos'),
('Seguimientos', 'followups_view_all', 'Ver todos los seguimientos de la empresa'),

-- Crear seguimientos
('Followups', 'followups_create', 'Registrar nuevos seguimientos'),
('Followups', 'followups_schedule', 'Programar próximos seguimientos'),
('Followups', 'followups_assign', 'Asignar seguimientos a otros'),

-- Editar seguimientos
('Followups', 'followups_edit_own', 'Editar mis propios seguimientos'),
('Followups', 'followups_edit_all', 'Editar cualquier seguimiento'),

-- Eliminar seguimientos
('Followups', 'followups_delete', 'Eliminar registros de seguimientos');

-- ==========================================
-- CALENDARIO (Calendar)
-- ==========================================
INSERT INTO permission_definitions (category, permission_key, label) VALUES
-- Ver calendario
('Calendario', 'calendar_view_own', 'Ver mi calendario personal'),
('Calendario', 'calendar_view_team', 'Ver calendario del equipo completo'),

-- Eventos
('Calendario', 'calendar_create_events', 'Crear eventos en calendario'),
('Calendario', 'calendar_edit_events', 'Editar eventos del calendario');

-- ==========================================
-- DASHBOARD Y REPORTES (Dashboard & Reports)
-- ==========================================
INSERT INTO permission_definitions (category, permission_key, label) VALUES
-- Dashboard
('Dashboard', 'dashboard_view_own', 'Ver mis estadísticas personales'),
('Dashboard', 'dashboard_view_company', 'Ver estadísticas completas de la empresa'),
('Dashboard', 'dashboard_view_team_performance', 'Ver rendimiento del equipo'),

-- Filtros
('Dashboard', 'dashboard_filter_dates', 'Filtrar por rangos de fechas'),
('Dashboard', 'dashboard_export', 'Exportar datos del dashboard');

-- Set default permissions for super_admin (all enabled)
INSERT INTO role_permissions (role, permission_key, is_enabled)
SELECT 'super_admin', permission_key, true
FROM permission_definitions
ON CONFLICT (role, permission_key) DO UPDATE SET is_enabled = true;

-- Set default permissions for company_admin
INSERT INTO role_permissions (role, permission_key, is_enabled)
SELECT 'company_admin', permission_key, true
FROM permission_definitions
WHERE category IN ('Equipo', 'Leads', 'Seguimientos', 'Calendario', 'Dashboard')
  AND permission_key NOT LIKE '%_global'
ON CONFLICT (role, permission_key) DO NOTHING;

-- Specific company_admin permissions
INSERT INTO role_permissions (role, permission_key, is_enabled) VALUES
('company_admin', 'reports_export_company', true),
('company_admin', 'team_view_all', true),
('company_admin', 'team_create_members', true),
('company_admin', 'team_edit_members', true),
('company_admin', 'team_edit_roles', true),
('company_admin', 'team_toggle_status', true),
('company_admin', 'team_delete_members', true),
('company_admin', 'leads_view_all', true),
('company_admin', 'leads_edit_all', true),
('company_admin', 'leads_delete_all', true),
('company_admin', 'followups_view_all', true),
('company_admin', 'followups_edit_all', true),
('company_admin', 'calendar_view_team', true),
('company_admin', 'dashboard_view_company', true),
('company_admin', 'dashboard_view_team_performance', true)
ON CONFLICT (role, permission_key) DO UPDATE SET is_enabled = true;

-- Set default permissions for sales_agent (limited)
INSERT INTO role_permissions (role, permission_key, is_enabled) VALUES
('sales_agent', 'team_view_all', true), -- Can see team list
('sales_agent', 'leads_view_assigned', true),
('sales_agent', 'leads_create', true),
('sales_agent', 'leads_edit_own', true),
('sales_agent', 'leads_change_status', true),
('sales_agent', 'leads_change_priority', true),
('sales_agent', 'leads_upload_docs', true),
('sales_agent', 'leads_view_docs', true),
('sales_agent', 'followups_view_own', true),
('sales_agent', 'followups_create', true),
('sales_agent', 'followups_schedule', true),
('sales_agent', 'followups_edit_own', true),
('sales_agent', 'calendar_view_own', true),
('sales_agent', 'calendar_create_events', true),
('sales_agent', 'calendar_edit_events', true),
('sales_agent', 'dashboard_view_own', true),
('sales_agent', 'dashboard_filter_dates', true)
ON CONFLICT (role, permission_key) DO UPDATE SET is_enabled = true;
