---
description: Pendientes priorizados del CRM — retomar en próxima sesión
---

# 📋 Estado del CRM — Sesión 14 Mar 2026 (11:47 AM)

## ✅ COMPLETADO HOY (14 Mar AM)

### 🛡️ Sistema Anti-Contaminación de Proyectos
- **`.agent/PROJECT_IDENTITY.md`** — Identidad del proyecto con lista de keywords de alerta por proyecto hermano (ERP, GlobalAds, VisionSaaS)
- **`.agent/workflows/session-start.md`** — Protocolo de inicio de sesión seguro con tabla de señales de alerta
- Regla: si aparece DTE, plan_de_cuentas, BigVU, etc. → STOP antes de tocar nada

### 🎯 Campaign Builder — Mejoras de Audiencia
- **Estado "Perdido"** agregado al filtro de estados → permite campañas de re-engagement a leads perdidos
- **Modal de Rubros/Industria** — reemplaza 24+ chips desbordados por:
  - Botón compacto `"🔍 X rubros seleccionados"` en el panel
  - Modal con buscador en tiempo real, grilla 2 columnas, checkmarks individuales
  - Acciones rápidas: "Seleccionar todos" / "Limpiar"
  - Pills con ❌ para ver/remover seleccionados sin abrir el modal
  - Color de marca `#0097A7` con `style={{}}` inline (para preservar encoding UTF-8)
- **Commit:** `f683115` → pushed to `main` → deploy automático en Vercel
- **Lección aprendida:** Nunca usar PowerShell `Set-Content` para editar archivos TSX/TSX con tildes → corrompe encoding. Siempre usar el editor de archivos del agente.



## ✅ COMPLETADO HOY

### 🔔 Sistema de Notificaciones de Seguimiento
- **Tabla `notifications`** + **`push_subscriptions`** creadas en BD
- **Edge Function** `send-followup-reminders` → corre cada minuto via `pg_cron`
- **Lógica por rol implementada:**
  - `sales_agent` → solo leads asignados a ellos
  - `company_admin` → todos los leads de su empresa
  - `super_admin` (Jimmy) → todas las empresas (dueño del sistema)
- **RLS** en `notifications` — cada usuario solo lee las suyas
- **Helper functions:**
  - `get_pending_followup_notifications()` — detecta follow-ups vencidos
  - `get_notification_recipients(lead_id, company_id, assigned_to)` — retorna quién recibe
- **Frontend:**
  - `src/services/notifications.ts` — servicio con Realtime + Web Push
  - `src/hooks/useNotifications.ts` — hook centralizado con sonido
  - `src/components/NotificationBell.tsx` — bell con badge, dropdown, sound
  - `public/sw.js` — Service Worker para notificaciones nativas
  - `DashboardLayout.tsx` — bell integrado en el header

### 🐛 Fix: Campaign Save Error (Marketing Hub)
- **Bug:** `POST 400` al guardar campaña
- **Causa:** `type = 'telegram'` no estaba en el CHECK constraint de la BD
- **Fix BD:** Agregado `'telegram'` al constraint `marketing_campaigns_type_check`
- **Fix código:**
  - `template_id: ''` → `null` (UUID column requiere null, no string vacío)
  - Removido `created_by` (FK a `auth.users` violaba en modo SIM)
  - Error message ahora muestra el error real de Supabase
- **Bonus:** Auto-save del draft en `localStorage` — sobrevive refresh de página

---

## 🟠 PENDIENTE — Prioridad Alta
**1. Invitación por email para nuevos admins (HubSpot style)**
- Super Admin ingresa email → Supabase envía invite → Admin configura su contraseña
- Archivos: `Companies.tsx`, `Team.tsx`

## 🟡 PENDIENTE — Prioridad Media
**2. Verificar migraciones en producción** (teams, team_members, call_goals, call_activities)

**3. Permisos granulares por módulo** (ver/crear/editar/eliminar por módulo)

## 🔵 Backlog
- Self-service onboarding, roles predefinidos, 2FA, Business Units
- Web Push con VAPID keys (actualmente usa in-app polling)

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
