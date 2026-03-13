---
description: Pendientes priorizados del CRM — retomar en próxima sesión
---

# 📋 Pendientes CRM — Próxima Sesión

## ✅ Resuelto (11 Mar 2026)
- ✅ Footer `PublicQuoteView` — dark card `bg-[#0f172a]` premium, sin espacio blanco abajo
- ✅ Planes comparativos en link móvil — funcionando
- ✅ Share Modal `CotizacionDetalle` — modal centrado en desktop, bottom sheet en móvil intacto

---

## 🟠 Prioridad Alta

### 1. Invitación por email para nuevos admins (HubSpot style)
- **Problema:** Actualmente el admin crea la contraseña manualmente
- **Solución:** Flujo de invitación: Super Admin ingresa email → Supabase envía invite → Admin configura su propia contraseña
- **Referencia:** HubSpot Settings > Users & Teams > Create User (invitation by email)
- **Archivos involucrados:** `src/pages/admin/Companies.tsx`, `src/pages/company/Team.tsx`

---

## 🟡 Prioridad Media

### 2. Verificar migraciones en producción
- **Tablas a verificar:** `teams`, `team_members`, `call_goals`, `call_activities`
- **Archivo SQL:** `sql/migrations/phase4_create_teams_system.sql`
- **Riesgo:** Si no existen en prod, Teams y Activity Tracking están rotos silenciosamente
- **Acción:** Correr `list_tables` en Supabase prod y aplicar migraciones faltantes

### 3. Permisos granulares por módulo
- **Problema:** Solo se puede activar/desactivar módulos completos
- **Solución:** Control de acciones dentro de cada módulo (ver, crear, editar, eliminar)
- **Referencia:** HubSpot permissions por Hub (Marketing, Sales, Service)
- **Archivos:** `src/pages/company/Permissions.tsx`, `src/services/permissions.ts`

---

## 🔵 Prioridad Baja (Backlog HubSpot)
- [ ] Self-service onboarding — empresas se registran solas
- [ ] Roles predefinidos — templates (Admin, Sales Rep, Manager, Viewer)
- [ ] Business Units — múltiples marcas dentro de una cuenta
- [ ] Two-Factor Authentication para admins
