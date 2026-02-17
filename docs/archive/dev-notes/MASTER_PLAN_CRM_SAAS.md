# 🚀 MASTER PLAN: CRM SaaS — Production-Grade, Scalable, Secure & Better Than HubSpot

**Fecha**: 2026-02-17  
**Estado Actual**: Sistema funcional con 3 empresas, 113 leads, 11 Edge Functions, 24 tablas  
**Objetivo**: Llevar el CRM de "funcional pero con deuda técnica" a **Enterprise-Grade SaaS**

---

## 📊 RESUMEN EJECUTIVO DEL DIAGNÓSTICO

### Lo que ya funciona bien ✅
- Multi-tenancy con RLS activo en todas las tablas
- Bundle size excelente (~150KB) con code splitting
- Quoting Engine con paridad matemática (Dashboard, Public View, PDF, AI)
- AI Agent (118 versiones del procesador — maduro)
- 11 Edge Functions en producción activas
- Sistema de permisos granulares (76 definiciones, 331 asignaciones)
- Lead Discovery (Google Places)
- Marketing multi-canal (Email, WhatsApp, Telegram)

### Lo que necesita trabajo ⚠️
| Categoría | Issues Críticos | Issues de Warning | Info |
|:---|:---:|:---:|:---:|
| **Seguridad** | 1 ERROR + 6 WARN | 27 funciones sin search_path | 3 tablas sin policies |
| **Performance** | 0 | 40+ RLS initplan warnings | 18 FK sin índice |
| **Código** | Leads.tsx = 195KB (!!) | Dashboard.tsx = 87KB | CotizadorPro = 100KB |
| **Arquitectura** | Sin billing | Sin audit log | Sin onboarding automatizado |

---

## 🔴 FASE 1: SEGURIDAD CRÍTICA (Semana 1-2)
*Sin esto, NO es seguro comercializar el SaaS*

### 1.1 🚨 SECURITY DEFINER VIEW — ERROR
- **Tabla**: `public.lead_marketing_stats` está definida con `SECURITY DEFINER`
- **Riesgo**: Ejecuta con los permisos del creador, NO del usuario, bypaseando RLS
- **Fix**: Recrear la view como `SECURITY INVOKER`
- [Referencia](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)

### 1.2 🚨 RLS Policies = `USING (true)` — 5 tablas expuestas
Estas tablas tienen políticas que permiten acceso total a cualquier usuario autenticado:
| Tabla | Policy Name | Riesgo |
|:---|:---|:---|
| `cotizaciones` | "All Access" | **Tenant A puede ver/editar cotizaciones de Tenant B** |
| `financing_plans` | "Enable all interaction" | Cualquier tenant puede modificar planes financieros de otros |
| `marketing_campaigns` | "Allow All Access" | Campañas de marketing visibles entre tenants |
| `payment_settings` | "Enable all interaction" | Configuración de pagos sin aislamiento |
| `marketing_ai_logs` | "Allow service role" | Logs de AI sin aislamiento (menor riesgo) |

**Acción**: Reemplazar TODAS con policies basadas en `company_id`

### 1.3 ⚠️ Tablas SIN ninguna RLS Policy (3)
- `marketing_lead_searches` — tiene RLS habilitado pero 0 policies
- `marketing_templates` — tiene RLS habilitado pero 0 policies  
- `permissions_matrix` — tiene RLS habilitado pero 0 policies

**Efecto**: Los datos de estas tablas están **100% bloqueados** (RLS ON + sin policies = nadie puede acceder). Es posible que no funcionen correctamente.

### 1.4 ⚠️ Funciones sin `search_path` fijo (27 funciones)
**Riesgo**: Inyección de schema. Un atacante podría crear un schema malicioso con funciones del mismo nombre.

Funciones afectadas más críticas:
- `admin_create_user` (4 versiones!)
- `admin_delete_user`
- `get_dashboard_stats`
- `get_auth_role` / `get_auth_company_id`
- `is_super_admin`
- `handle_new_user`
- `process_incoming_marketing_message`

**Fix**: Agregar `SET search_path = public, extensions` a todas.

### 1.5 ⚠️ Leaked Password Protection deshabilitada
- **Acción**: Activar protección contra contraseñas filtradas (HaveIBeenPwned)
- [Referencia](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

### 1.6 🔴 Hardcoded Admin Bypasses (del audit anterior)
- `AuthProvider.tsx` contiene IDs de desarrollador hardcodeados para "Master Bypass"
- **Acción**: Mover a variables de entorno inmediatamente

### 1.7 🔴 Console.logs en producción
- **Acción**: Configurar Vite para strip consoles en build de producción

---

## 🟡 FASE 2: PERFORMANCE & ESTABILIDAD (Semana 2-3)
*Escalar sin dolor*

### 2.1 RLS Policies con `auth.<function>()` sin subquery (35+ policies)
**Problema**: Cada política re-evalúa `auth.uid()` **por cada fila** en lugar de una sola vez.

Tablas afectadas: `cotizaciones`, `companies`, `pricing_items`, `role_permissions`, `cotizador_paquetes`, `cotizador_items`, `marketing_integrations`, `follow_ups`, `marketing_conversations`, `marketing_messages`, `custom_roles`, `loss_reasons`, `profiles`, `sales_goals`

**Fix patrón**:
```sql
-- ❌ LENTO (re-evaluates per row)
USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))

-- ✅ RÁPIDO (evaluates once)  
USING (company_id = (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid())))
```

### 2.2 Foreign Keys sin índices (18 FK)
Tablas sin índice en columnas FK (causa JOINs lentos):
- `leads.company_id`, `leads.assigned_to`
- `follow_ups.lead_id`, `follow_ups.user_id`, `follow_ups.assigned_to`
- `profiles.company_id`, `profiles.custom_role_id`
- `cotizaciones.created_by`
- `marketing_campaigns.created_by`
- `sales_goals.company_id`
- Y 8 más en tablas de configuración

**Fix**: Crear índices B-tree para cada FK.

### 2.3 Multiple Permissive Policies (masivo en `cotizaciones` y `pricing_items`)
- `cotizaciones` tiene hasta **3 policies redundantes** por acción/rol
- `pricing_items` tiene duplicados en **cada rol y acción**
- **Acción**: Consolidar en 1 policy por acción que maneje super_admin + company_id

### 2.4 Índices no utilizados (5)
- `idx_templates_global` en `marketing_templates`
- `idx_items_company`, `idx_items_activo` en `cotizador_items`
- `idx_campaigns_company` en `marketing_campaigns`
- `idx_cotizaciones_estado`, `idx_leads_lost_stage`

**Acción**: Eliminar o evaluar si se necesitan.

---

## 🟠 FASE 3: CÓDIGO & ARQUITECTURA (Semana 3-5)
*Mantenibilidad y velocidad de desarrollo*

### 3.1 🔴 Componentes Gigantes (Deuda Técnica Crítica)
| Archivo | Tamaño | Equivalente |
|:---|:---|:---|
| `Leads.tsx` | **195KB** (¡~5000+ líneas!) | Un libro completo |
| `CotizadorPro.tsx` | **100KB** | Demasiado para un solo archivo |
| `Dashboard.tsx` | **87KB** | Difícil de mantener |
| `CotizacionDetalle.tsx` | **60KB** | Complejo pero manejable |

**Plan de Refactor**:
```
src/features/leads/
  ├── components/
  │   ├── LeadTable.tsx
  │   ├── LeadKanban.tsx
  │   ├── LeadFilters.tsx
  │   ├── LeadModal.tsx
  │   └── LeadImport.tsx
  ├── hooks/
  │   ├── useLeadFilters.ts
  │   ├── useLeadActions.ts
  │   └── useLeadStats.ts
  └── index.tsx (orchestrator)
```

### 3.2 Duplicación de funciones admin_create_user
- **4 versiones** de `admin_create_user` en la base de datos
- **Acción**: Consolidar en 1 sola función robusta

### 3.3 SQL files desorganizados (70+ en el root)
- `EJECUTAR_AHORA.sql`, `HARDEN_SAAS_SECURITY.sql`, etc. están en el root
- **Acción**: Organizar en `migrations/` con tracking de ejecución

### 3.4 Markdown files de documentación acumulados (40+ en root)
- `FIX_MODAL_*.md`, `SISTEMA_*.md`, `RESUMEN_*.md`, etc.
- **Acción**: Consolidar en `docs/` o archivar completados

### 3.5 Estandarizar Service Layer
Implementar la interfaz unificada:
```typescript
export interface ServiceResponse<T> {
  data: T | null;
  error: Error | null;
  success: boolean;
}
```

---

## 🔵 FASE 4: FEATURES ESTILO HUBSPOT (Semana 5-8)
*Lo que nos falta para competir con HubSpot*

### 4.1 📨 Invitación por Email (Alta Prioridad)
- Actualmente: Crear usuario con contraseña manualmente
- **HubSpot**: Envía invitación → usuario configura su propia contraseña
- **Acción**: Implementar flujo con Supabase Auth magic link + `company_invitations`

### 4.2 🔑 Permisos Granulares por Módulo (Alta Prioridad)
- Ya tenemos 76 `permission_definitions` y la tabla `role_permissions`
- **Falta**: UI para gestionar permisos por módulo (ver, crear, editar, eliminar)
- **HubSpot**: Permisos por Hub (Marketing, Sales, Service, CMS)

### 4.3 👥 Equipos/Teams (Alta Prioridad)
- Actualmente: Solo roles individuales
- **HubSpot**: Agrupar usuarios por departamento
- **Requiere**: Tabla `teams` + `team_members` con jerarquía

### 4.4 📋 Audit Log (Media Prioridad)
- **HubSpot**: Registra quién cambió qué y cuándo
- **Implementación**: Triggers de Postgres → tabla `audit_log`
- Crítico para compliance y debugging en multi-tenancy

### 4.5 🎯 Self-Service Onboarding (Media Prioridad)
- Actualmente: Onboarding manual
- **HubSpot**: Registro autónomo → trial → conversión
- **Implementación**: Wizard multi-step con branding, team invite, data import

### 4.6 📊 Roles Predefinidos / Templates (Media Prioridad)
- Templates: Admin, Sales Rep, Manager, Viewer
- Ya hay 6 `custom_roles` — extender con templates por defecto

### 4.7 🔐 Two-Factor Authentication (Baja Prioridad)
- Supabase Auth soporta MFA nativamente
- **Acción**: Habilitar y agregar UI de configuración

### 4.8 🏢 Business Units (Baja Prioridad)
- Múltiples marcas dentro de una misma cuenta
- Arquitectura compleja — priorizar después

---

## 🟣 FASE 5: MONETIZACIÓN & ESCALABILIDAD (Semana 8-12)
*Convertir en negocio real*

### 5.1 💰 Billing & Subscriptions (Crítico)
- **Estado**: Solo tiene `max_users` sin mecanismo de cobro
- **Sistema**: Stripe/Paddle integration
- **Modelo**: Tiers (Starter $29, Pro $99, Enterprise $199)
- **Tabla**: `company_subscriptions` con status, plan, período

### 5.2 📈 Tenant Observability
- Métricas por tenant: usuarios activos, storage, leads/mes, API calls
- Dashboard de Super Admin con health de cada tenant
- **Tabla**: `tenant_metrics` con agregación periódica

### 5.3 📤 Data Export / GDPR Compliance
- Backup/restore per-company
- Exportar ZIP/JSON de todo el data de una empresa
- Cumplimiento de privacidad de datos

### 5.4 🔗 Webhooks Engine
- Permitir integraciones externas: Slack, ERPs, Zapier
- Eventos: `lead.created`, `quote.accepted`, `user.joined`
- **Tabla**: `webhook_subscriptions` + Edge Function dispatcher

### 5.5 🤖 AI Premium Features
- Marketing AI Hub como add-on premium
- Unlimited AI agents para Enterprise tier
- Mass messaging volume tiers

---

## 📋 PRIORIZACIÓN RECOMENDADA

| # | Tarea | Impacto | Esfuerzo | Riesgo si no se hace |
|:---:|:---|:---|:---|:---|
| 1 | Fix Security Definer View | 🔴 Crítico | 15 min | Data leak entre tenants |
| 2 | Fix RLS `USING(true)` (5 tablas) | 🔴 Crítico | 1 hora | **Tenants ven data de otros** |
| 3 | Add RLS policies a 3 tablas vacías | 🔴 Crítico | 30 min | Data bloqueado/expuesto |
| 4 | Enable Leaked Password Protection | 🟡 Alto | 5 min | Passwords comprometidos |
| 5 | Eliminar hardcoded admin bypass | 🟡 Alto | 30 min | Backdoor permanente |
| 6 | Fix `search_path` en 27 functions | 🟡 Alto | 2 horas | Schema injection |
| 7 | Strip console.logs en prod build | 🟡 Medio | 15 min | Info leak en browser |
| 8 | Fix RLS subquery performance | 🟡 Medio | 3 horas | Queries lentos a escala |
| 9 | Add FK indexes | 🟡 Medio | 1 hora | JOINs lentos |
| 10 | Consolidar policies redundantes | 🟡 Medio | 4 horas | Performance innecesario |
| 11 | Refactor Leads.tsx | 🟠 Medio | 8 horas | Imposible de mantener |
| 12 | Invitación por email | 🟠 Feature | 4 horas | Experiencia manual |
| 13 | Audit Log | 🟠 Feature | 6 horas | Sin trazabilidad |
| 14 | Billing integration | 🔵 Negocio | 3 semanas | No hay revenue |
| 15 | Self-service onboarding | 🔵 Negocio | 2 semanas | Proceso manual |

---

## 🎯 SIGUIENTE PASO RECOMENDADO

**Empezar hoy con la Fase 1 de Seguridad (ítems 1-7)**. Son las correcciones más rápidas con el mayor impacto en la protección de datos entre tenants. **Sin estas correcciones, cualquier empresa que se registre puede potencialmente ver las cotizaciones y campañas de marketing de otro tenant.**

¿Quieres que arranquemos con las correcciones de seguridad ahora?
