# 🔐 CHECKPOINT: Remediación de Arquitectura de Seguridad
**Fecha:** 2026-03-29 | **Proyecto:** crm-app | **Supabase PROD:** ikofyypxphrqkncimszt

## Problema Reportado
1. Leads "perdidos" — no aparecen
2. Datos de Ensivar visibles en cuenta admin de Arias Defense (RLS breach)

## Diagnóstico Real

### ✅ Leads no se perdieron
- Arias Defense: 532 leads (399 activos) ← TODOS PRESENTES
- Ensivar: 18 leads (empresa legítima, segundo tenant)
- El problema era que super_admin veía TODOS los tenants

### ⚠️ Problema Confirmado: RLS insuficiente
- La política `leads_v4_all` usaba `check_is_super_admin()` que hacía bypass total
- Un super_admin de Arias Defense podía ver leads de Ensivar y viceversa

### ⚠️ Contaminación de tablas
- Las tablas `ga_*` (GlobalAds AI OS) están en esta misma DB de Supabase
- Tienen datos activos (135 orgs, 285 module_access records) — pertenecen a otro proyecto
- NO se eliminaron para no romper GlobalAds
- Son inofensivas para crm-app (RLS separado por prefijo ga_)

## Remediaciones Aplicadas

### Migración 1: `crm_security_architecture_remediation_v1`
- ✅ `get_auth_company_id()` reforzada (null-safe, doble fallback)
- ✅ `leads_v4_all` — eliminado bypass de super_admin, aislamiento total por `company_id`
- ✅ `follow_ups_tenant_policy` — reforzada con null-safe
- ✅ `audit_logs_read` — filtrada por company_id del autenticado
- ✅ `marketing_campaigns_tenant_policy` — reforzada
- ✅ `call_activities_tenant_policy` — reforzada

### Migración 2: `fix_remaining_critical_tables_rls`
- ✅ Tickets: 4 políticas separadas por operación (SELECT/INSERT/UPDATE/DELETE)
- ✅ Cotizaciones: política de tenant reforzada
- ✅ Cotizador paquetes/items: aislamiento por company
- ✅ Industries: aislamiento por company
- ✅ Loss reasons: aislamiento por company
- ✅ Teams: aislamiento por company
- ✅ Notifications: usuario + company

### Migración 3: `cleanup_test_companies_and_orphan_data`
- ✅ Eliminadas 5 companies "Mi Empresa" (registros de prueba vacíos)
- ✅ Solo quedan: Arias Defense, Ensivar S.A., Sistema Arias Defense

### Migración 4: `fix_remaining_rls_gaps_audit_tickets_notif`
- ✅ `audit_logs_insert` — with_check por company_id
- ✅ `tickets_insert` — with_check por company_id
- ✅ `notifications_update` — filtro company + user_id
- ✅ `notifications_insert` para authenticated

## Estado Final

| Tabla | Aislamiento |
|---|---|
| leads | ✅ null-safe por company_id |
| follow_ups | ✅ vía leads.company_id |
| cotizaciones | ✅ null-safe por company_id |
| tickets | ✅ null-safe por company_id |
| call_activities | ✅ null-safe por company_id |
| marketing_campaigns | ✅ null-safe por company_id |
| audit_logs | ✅ null-safe por company_id |
| notifications | ✅ user_id + company_id |

## Pendiente (no crítico)
- Las tablas `ga_*` siguen en esta DB — deberían migrarse al Supabase de GlobalAds en algún momento
- El Portal de Cliente (cotizaciones públicas) usa acceso anon — monitorear
