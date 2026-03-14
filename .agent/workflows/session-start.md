---
description: Protocolo de inicio de sesión seguro — verificar identidad del proyecto antes de trabajar
---

# 🔐 Protocolo de Inicio de Sesión — CRM App

> **EJECUTAR ESTE WORKFLOW AL INICIO DE CADA SESIÓN**
> Previene contaminación cruzada entre proyectos (CRM, ERP El Salvador, GlobalAds, VisionSaaS).

---

## Paso 1: Leer la identidad del proyecto

// turbo
Leer `.agent/PROJECT_IDENTITY.md` para confirmar en qué proyecto estamos trabajando.

## Paso 2: Confirmar el workspace activo

Verificar que el workspace abierto en VS Code corresponde a:
- **Ruta:** `c:\Users\jaria\OneDrive\DELL\Desktop\crm-app`
- **Repo:** `Jarias7604/crm-app`

Si el usuario menciona funcionalidades que NO están en la lista de `PROJECT_IDENTITY.md`, **DETENER y preguntar** antes de continuar.

## Paso 3: Verificar Project ID de Supabase

Antes de ejecutar cualquier migración SQL o deploy de edge function:
1. Leer `.env.local` para obtener el `VITE_SUPABASE_URL`
2. Confirmar con el usuario que el Project ID corresponde al CRM (no al ERP u otro proyecto)
3. Si hay duda → NO ejecutar. Preguntar primero.

## Paso 4: Check de pendientes

Opcionalmente, leer `.agent/workflows/hubspot-architecture.md` para retomar tareas pendientes de la sesión anterior.

---

## 🚨 Señales de Alerta (STOP & ASK)

Si el usuario menciona alguna de estas palabras clave, **DETENER inmediatamente** y confirmar que estamos en el proyecto correcto:

| Keyword sospechosa | Proyecto al que pertenece |
|--------------------|--------------------------|
| `DTE`, `CCF`, `FCF`, `NRC` | ERP El Salvador |
| `plan de cuentas`, `partidas`, `NIIF` | ERP El Salvador |
| `libro de IVA`, `libro de ventas` | ERP El Salvador |
| `módulo de compras`, `proveedores`, `recepción` | VisionSaaS |
| `BigVU`, `video studio`, `ad creative` | GlobalAds AI OS |
| `meta-insights`, `campaign AI`, `DALL-E ads` | GlobalAds AI OS |

