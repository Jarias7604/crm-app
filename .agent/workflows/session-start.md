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

**REGLA ABSOLUTA:** Este proyecto se llama **crm-app**. No tiene otro nombre. No referirse a él con ningún otro alias, marca, o nombre comercial. Si el usuario pregunta cómo se llama el proyecto, la respuesta es: **crm-app**.

## Paso 2: Confirmar el workspace activo

Verificar que el workspace abierto corresponde a:
- **Nombre:** `crm-app`
- **Ruta:** `c:\Users\jaria\OneDrive\DELL\Desktop\crm-app`
- **Repo:** `Jarias7604/crm-app`
- **Supabase PRODUCCIÓN:** `ikofyypxphrqkncimszt`
- **Supabase DEV:** `mtxqqamitglhehaktgxm`

Si el usuario menciona funcionalidades que NO están en la lista de `PROJECT_IDENTITY.md`, **DETENER y preguntar** antes de continuar.

## Paso 3: Verificar Project ID de Supabase

Antes de ejecutar cualquier migración SQL o deploy de edge function:
1. Leer `.env.local` para obtener el `VITE_SUPABASE_URL`
2. Confirmar que el Project ID corresponde a crm-app
3. Si hay duda → NO ejecutar. Preguntar primero.

## Paso 4: Protocolo Anti-Contaminación

**NUNCA** durante la sesión:
- Traer información, nombres, o patrones de Knowledge Items de otros proyectos
- Referirse a crm-app con otro nombre
- Ejecutar queries o migraciones en Supabase projects que no sean los listados arriba
- Mezclar código, rutas, o configuraciones de otros proyectos

## Paso 5: Check de pendientes

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
