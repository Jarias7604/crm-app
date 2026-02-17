---
description: Revisar y aplicar estructura HubSpot al CRM - pendiente para próxima sesión
---

# 🔶 PENDIENTE: Reestructurar Admin Panel estilo HubSpot

## Contexto (2026-02-17)
El usuario quiere que la Administración Comercial & Licencias siga el modelo de HubSpot.

## Cambios realizados hoy:
1. ✅ Formulario unificado de admin (crear/editar en un solo form)
2. ✅ Super Admin puede actualizar CUALQUIER empresa (RLS fix)
3. ✅ Update directo a profiles sin RPC problemático
4. ✅ Esquemas DEV y PROD alineados (columna tax_id)
5. ✅ Función duplicada admin_update_user eliminada

## Fase 4: HubSpot Features — Implementadas:

### ✅ Feature 4.1: Audit Log (Registro de Actividad)
- Tabla `audit_logs` con RLS, indexes, triggers automáticos
- Triggers en: leads, profiles, cotizaciones, teams
- Función `log_audit_event()` para logging manual
- Servicio: `src/services/auditLog.ts`
- Página: `src/pages/admin/AuditLog.tsx`
- Ruta: `/admin/audit-log` (Super Admin only)

### ✅ Feature 4.4: Equipos/Teams & Departamentos
- Tablas `teams` + `team_members` con RLS completo
- Emoji + color customization (mejor que HubSpot)
- Leader assignment con roles (leader/member)
- Audit triggers integrados con audit_logs
- Servicio: `src/services/teams.ts`
- Página: `src/pages/company/Teams.tsx`
- Ruta: `/company/teams` (Admin only)

## Lo que falta implementar (estilo HubSpot):

### Prioridad Alta:
- [ ] **Invitación por email** — En vez de crear contraseña manualmente, enviar invitación al admin para que configure su propia contraseña
- [ ] **Permisos granulares por módulo** — No solo activar/desactivar módulos, sino controlar acciones dentro de cada módulo (ver, crear, editar, eliminar)

### Prioridad Media:
- [ ] **Self-service onboarding** — Permitir que empresas se registren solas (como HubSpot free)
- [ ] **Roles predefinidos** — Templates de permisos (Admin, Sales Rep, Manager, Viewer)

### Prioridad Baja:
- [ ] **Business Units** — Manejar múltiples marcas dentro de una misma cuenta
- [ ] **Two-Factor Authentication** — Seguridad adicional para admins

## Referencia HubSpot:
- Settings > Users & Teams > Create User (invitación por email)
- Permisos por Hub (Marketing, Sales, Service, CMS)
- Principio de mínimo privilegio
- Super Admin limitado a pocos usuarios por seguridad
