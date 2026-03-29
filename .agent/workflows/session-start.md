---
description: Protocolo de inicio de sesión seguro — verificar identidad del proyecto antes de trabajar
---

# 🔐 Protocolo de Inicio de Sesión — crm-app

> **EJECUTAR ESTE WORKFLOW AL INICIO DE CADA SESIÓN**
> Previene contaminación cruzada entre proyectos.

---

## Paso 1: Leer la identidad del proyecto

// turbo
Leer `.agent/PROJECT_IDENTITY.md` para confirmar en qué proyecto estamos trabajando.

**REGLA ABSOLUTA:** Este proyecto se llama **crm-app**. No referirse con otro nombre o alias.

## Paso 2: Confirmar el workspace activo

Verificar:
- **Ruta:** `c:\Users\jaria\OneDrive\DELL\Desktop\crm-app`
- **Supabase PRODUCCIÓN:** `ikofyypxphrqkncimszt`
- **Supabase DEV:** `mtxqqamitglhehaktgxm`

Si el usuario menciona funcionalidades fuera de `PROJECT_IDENTITY.md` → **DETENER y preguntar**.

## Paso 3: Verificar Project ID de Supabase

Antes de cualquier migración SQL o deploy:
1. Leer `.env.local` → confirmar `VITE_SUPABASE_URL`
2. Confirmar que el Project ID es `ikofyypxphrqkncimszt`
3. Si hay duda → NO ejecutar. Preguntar primero.

## Paso 4: ⚠️ OBLIGATORIO — Health Check de Base de Datos

**ANTES de cualquier migración que toque RLS, políticas o funciones de seguridad, ejecutar:**

```sql
SELECT * FROM public.crm_rls_health_check();
```

Los 5 checks deben estar en ✅ antes de proceder.
Si alguno falla → DETENER y reportar al usuario. No continuar.

**DESPUÉS de cada migración de RLS, ejecutar de nuevo:**
```sql
SELECT * FROM public.crm_rls_health_check();
-- Verificar leads accesibles (debe ser >= 500):
SELECT COUNT(*) FROM leads WHERE company_id = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';
```

Si el conteo es menor a 500 → **ROLLBACK INMEDIATO**. Reportar al usuario.

## Paso 5: Reglas de Oro para Migraciones de RLS

1. **NUNCA cambiar `get_auth_company_id()`** sin ejecutar health check antes y después
2. **NUNCA eliminar una política RLS existente** sin ejecutar health check después
3. **NUNCA asumir que el JWT tiene datos correctos** — usar `profiles` como fuente de verdad
4. **SIEMPRE usar `WITH CHECK`** en políticas ALL/INSERT/UPDATE para evitar escrituras cross-tenant
5. Si el health check falla tras un cambio → **rollback inmediato**, informar al usuario

## Paso 6: Protocolo Anti-Contaminación

**NUNCA** durante la sesión:
- Traer código o patrones de otros proyectos (GlobalAds, ERP, VisionSaaS)
- Ejecutar queries en Supabase projects que no sean los listados arriba
- Mezclar código, rutas, o configuraciones de otros proyectos

## Paso 7: Check de pendientes

Leer `.agent/workflows/hubspot-architecture.md` para retomar tareas pendientes.

---

## 🚨 Señales de Alerta (STOP & ASK)

| Keyword sospechosa | Proyecto al que pertenece |
|--------------------|--------------------------|
| `DTE`, `CCF`, `FCF`, `NRC` | ERP El Salvador |
| `plan de cuentas`, `partidas`, `NIIF` | ERP El Salvador |
| `libro de IVA`, `libro de ventas` | ERP El Salvador |
| `módulo de compras`, `proveedores`, `recepción` | VisionSaaS |
| `BigVU`, `video studio`, `ad creative` | GlobalAds AI OS |
| `meta-insights`, `campaign AI`, `DALL-E ads` | GlobalAds AI OS |
| `ga_organizations`, `ga_profiles`, `ga_campaigns` | GlobalAds AI OS |

---

## 📋 Lecciones del Incidente 2026-03-29

**Qué pasó:** Se cambió la función `get_auth_company_id()` para leer JWT primero. El JWT de `jarias7604@gmail.com` tenía `company_id = 00000000...` (incorrecto). El agente no verificó el estado post-migración. Resultado: 531 leads invisibles + calendario vacío.

**Protecciones implementadas permanentemente:**
- `get_auth_company_id()` lee desde `profiles` (siempre correcto, nunca del JWT)
- Trigger `trg_sync_company_to_jwt` mantiene JWT sincronizado automáticamente al cambiar profile
- Trigger `trg_sync_new_user_jwt` sincroniza JWT al crear usuario nuevo
- `crm_rls_health_check()` — función de diagnóstico rápido disponible en DB
- Este workflow incluye el health check como paso OBLIGATORIO
