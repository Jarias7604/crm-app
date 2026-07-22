---
description: Reglas de seguridad para NO romper producción — LEER ANTES DE CADA CAMBIO
---

# Reglas de Seguridad — OBLIGATORIAS EN CADA SESIÓN

> STOP. Antes de escribir una sola línea de código, lee estas reglas.
> Cada regla existe porque costó horas reales de tiempo del cliente.

---

## MAPA DE PROYECTOS — VERIFICAR SIEMPRE CONTRA ESTE ARCHIVO

| Ambiente | Supabase URL | Project Ref | Uso |
|----------|-------------|-------------|-----|
| **Edge Functions / AI** | `ikofyypxphrqkncimszt` | `ikofyypxphrqkncimszt` | Sofía, Telegram, Orchestrator, Edge Fn — **NUNCA bases de datos CRM** |
| **CRM Producción** | `mtxqqamitglhehaktgxm.supabase.co` | `mtxqqamitglhehaktgxm` | Datos reales: leads, usuarios, cotizaciones, tareas |
| **Testing / Local** | `ubqscyfefgfbmndnypbp.supabase.co` | `ubqscyfefgfbmndnypbp` | Activo en `.env.local`. Dev y pruebas |

> ⛔ **PROHIBIDO ABSOLUTO:** Ejecutar cualquier SQL de schema (ALTER TABLE, CREATE TABLE, DROP) en `ikofyypxphrqkncimszt`. Ese proyecto es SOLO para Edge Functions. Confundirlo con la base de datos del CRM ha causado incidentes reales.

**ANTES de ejecutar cualquier SQL en Supabase: abrir `.env.local` y confirmar el URL.**
Si el project ref no está en esta tabla → NO PROCEDER.

---

## REGLA 1 — Sin RPC sin función SQL definida

**PROHIBIDO:** `supabase.rpc('nombre_funcion')` si esa función no existe en el SQL de migración.

**OBLIGATORIO:** Antes de escribir cualquier `.rpc()`, verificar que el `CREATE FUNCTION` correspondiente esté en la migración. Si no existe → usar `upsert()`, `select()`, `update()` directo.

Costo del incumplimiento: Error en runtime que TypeScript no detecta. La feature se ve "lista" y rompe en producción.

---

## REGLA 2 — No declarar "listo" sin verificar en browser

**PROHIBIDO:** Responder "funciona" o "listo" sin haber visto el resultado en pantalla.

**OBLIGATORIO:** Después de cualquier cambio a servicios o DB, navegar al browser y confirmar:
- Sin errores en consola
- Sin toast rojo
- La acción del usuario produce el resultado esperado

Si el browser no confirma → NO es listo.

---

## REGLA 3 — Verificar columnas antes de agregarlas a SELECT

Si agregas una columna a `.select()`, verificar que existe en producción antes de hacer push.
Columnas que no existen en DB causan que la query ENTERA falle con 400 — la tabla se ve vacía.

**Patrón SAFE_FIELDS obligatorio para queries críticas:**
```typescript
const SAFE_FIELDS = '...columnas verificadas en prod...';
const { data, error } = await supabase.from('table').select(SAFE_FIELDS);
if (error) return fallback; // NUNCA dejar que el error rompa la UI
```

---

## REGLA 4 — Si un approach falla 2 veces, cambiar approach

Si el mismo comando o técnica falla dos veces seguidas → PARAR y usar el método más directo disponible.
No seguir golpeando el CLI si falla. Ir al dashboard. No seguir con RPCs si fallan. Ir a upsert directo.

---

## REGLA 5 — Nuevas columnas/tablas en DB → migración SQL PRIMERO

El orden correcto es:
1. Escribir la migración SQL con las tablas/columnas
2. Aplicarla en testing (vía dashboard Supabase)
3. Verificar que funciona en local
4. Aplicarla en producción
5. ENTONCES escribir el código que las usa

**NUNCA al revés.** El código que usa tablas que no existen rompe en runtime.

---

## REGLA 6 — No navegar a proyectos Supabase sin verificar identidad

Antes de abrir cualquier URL de Supabase dashboard, confirmar el project ref en esta tabla.
Si la URL no coincide con un proyecto de la tabla → cerrar esa pestaña.

---

## REGLA 7 — Mantener Edición e Inserción Nativa de Google Calendar y Botones Explícitos

**PROHIBIDO:** 
1. Revertir la edición nativa del CRM y reemplazarla con enlaces externos como `✏️ Editar en Google` para sacar al usuario de la aplicación.
2. Reintroducir el interruptor o switch de *"Notificar asistentes"* dentro del formulario del programador, ya que satura la UI y causa confusión sobre si se enviará correo o no.

**OBLIGATORIO:**
- Mantener la edición e inserción **100% nativa** en el CRM utilizando el componente `GoogleMeetScheduler` y el endpoint `update_event` de la Edge Function `google-calendar-sync`.
- El pie de página (footer) de `GoogleMeetScheduler` debe presentar siempre las **opciones de acción explícitas de un solo clic** para evitar errores:
  - **Botón "Solo Guardar" / "Solo Agendar":** Llama a la mutación pasando `false` para guardar/agendar el evento en Google Calendar sin enviar invitaciones.
  - **Botón "Guardar y Notificar" / "Crear y Notificar":** Llama a la mutación pasando `true` para guardar/crear el evento y gatillar automáticamente los correos de invitación desde Google Calendar.
- Desplegar la Edge Function `google-calendar-sync` siempre con el flag `--no-verify-jwt` para evitar bloqueos por falta de sesión del navegador en los procesos de sincronización en segundo plano.

---

## REGLA 8 — NUNCA ejecutar SQL de esquema en ikofyypxphrqkncimszt

**`ikofyypxphrqkncimszt` es SOLO para Edge Functions.** No es una base de datos del CRM.

**PROHIBIDO:**
- ALTER TABLE / CREATE TABLE / DROP en ese proyecto
- Ejecutar migraciones de schema (crm_tasks, profiles, leads, etc.) ahí
- Abrir ese proyecto en el SQL Editor para operaciones del CRM

**Las ÚNICAS bases de datos del CRM son:**
- Producción → `mtxqqamitglhehaktgxm`
- Testing → `ubqscyfefgfbmndnypbp`

Si el agente abre `ikofyypxphrqkncimszt` para algo que no sea deployment de Edge Functions → **PARAR INMEDIATAMENTE**.

---

## REGLA 9 — FROZEN CORE: Funciones críticas de RLS son intocables

Las siguientes funciones afectan **todas** las tablas simultáneamente. **PROHIBIDO** recrearlas, reescribirlas o modificarlas sin:
1. Inventario de impacto: `SELECT tablename, policyname FROM pg_policies WHERE qual LIKE '%nombre_funcion%';`
2. Prueba en testing + health check positivo
3. Autorización explícita del usuario antes de tocar producción

**Funciones FROZEN:**
- `get_auth_company_id()` — identidad de tenant para todas las RLS. Si falla, TODA la BD queda invisible.
- `get_auth_role()` — identidad de rol para todas las RLS.
- `auto_set_company_id()` — integridad de datos en inserciones.

**Incidente real (2026-06-08):** `get_auth_company_id()` fue reescrita para leer del JWT en vez de `profiles`. El JWT no siempre lleva `company_id`. Resultado: documentos, pipeline y configuraciones invisibles durante días.

---

## REGLA 10 — NUNCA usar `DROP ... CASCADE` sin inventario previo

`DROP FUNCTION nombre() CASCADE` borra **silenciosamente** todas las políticas RLS que dependan de esa función.

**ANTES de cualquier DROP CASCADE, ejecutar esto y revisar el resultado:**
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE qual LIKE '%nombre_funcion%' OR with_check LIKE '%nombre_funcion%';
```

Si hay resultados → recrear CADA política listada en la misma migración ANTES del DROP.

**Incidente real (2026-06-08):** `DROP FUNCTION get_auth_company_id() CASCADE` borró las políticas de `client_stage_document_types` y `client_documents`. El restore script cubrió 26 tablas pero omitió estas dos. Los documentos de clientes desaparecieron por días.

---

## REGLA 11 — NUNCA descartar cambios locales sin stash preventivo

**PROHIBIDO:** Ejecutar comandos de Git destructivos en el directorio de trabajo (tales como `git checkout -- <archivos>`, `git restore <archivos>`, `git reset --hard` o `git clean`) sin haber guardado un stash previo si existen cambios valiosos sin confirmar de la sesión o del cliente.

**OBLIGATORIO:** Antes de restaurar archivos para corregir errores, si hay cambios de código recientes importantes en curso, **ejecutar `git stash`** primero. De esta manera, si la restauración borra más archivos de los esperados o elimina el trabajo del día, se puede recuperar de inmediato con `git stash pop`.

**Incidente real (2026-06-14):** Se ejecutó `git checkout` en `FlyerStudio.tsx` para revertir una falla de compilación, lo que borró por completo todas las refactorizaciones avanzadas y configuraciones que no habían sido guardadas en un commit, perdiéndose horas de trabajo. Se tuvo que realizar una reconstrucción manual a partir de los registros de conversación.

---

## REGLA 12 — RLS Obligatorio en TODAS las nuevas tablas

**PROHIBIDO:** Crear o modificar tablas en el esquema público sin activar Row-Level Security (RLS) y definir políticas de aislamiento multi-tenant específicas.

**OBLIGATORIO:** Toda nueva tabla en `public` debe habilitar RLS explícitamente mediante `ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;` y añadir sus correspondientes políticas de aislamiento por `company_id`.

**Incidente real (2026-06-23):** Las tablas `lead_marketing_stats` y `login_attempts` fueron creadas por el agente en sesiones previas sin activar RLS, lo que provocó una alerta de vulnerabilidad grave de Supabase al dejar los datos expuestos públicamente.

---


---

## REGLA 13 — PROHIBIDO ABSOLUTO: Normalizar valores de `leads.status`

**CONTEXTO:** El campo `leads.status` usa TitleCase estricto (`Prospecto`, `Cerrado`, `Cliente`, `Perdido`, `Erróneo`, `En Nutrición`, `Lead calificado`, `En seguimiento`, `Negociación`, `Llamada fría`). Este formato es requerido simultáneamente por:
- El trigger `fn_auto_set_internal_won_date` (que registra la fecha real de cierre)
- La función RPC `get_dashboard_stats` (que agrega el embudo de ventas)
- El componente `STATUS_CONFIG` en el frontend (que renderiza los colores y etiquetas)

**PROHIBIDO ABSOLUTO:**
```sql
-- NUNCA ejecutar esto — rompe triggers, embudo y tendencia de ventas
UPDATE leads SET status = lower(status);
UPDATE leads SET status = upper(status);
UPDATE leads SET status = 'cerrado' WHERE ...;
```

**SI UN CLIENTE PIDE "normalizar" statuses:** El valor correcto siempre es TitleCase. Verificar contra `STATUS_CONFIG` en `src/types/index.ts` y el CHECK CONSTRAINT en la base de datos antes de ejecutar cualquier UPDATE de status.

**CHECK CONSTRAINT EN PRODUCCIÓN (instalado 2026-07-07):**
```sql
-- Este constraint hace IMPOSIBLE poner status inválido — cualquier UPDATE con valor incorrecto falla con error
CONSTRAINT check_leads_status_valid CHECK (status IN (
    'Prospecto', 'Llamada fría', 'En Nutrición', 'Lead calificado',
    'En seguimiento', 'Negociación', 'Cerrado', 'Cliente', 'Perdido', 'Erróneo'
))
```

**PROTOCOLO OBLIGATORIO antes de cualquier UPDATE masivo en `leads`:**
1. Ejecutar primero un `SELECT COUNT(*)` con el mismo WHERE — confirmar cuántas filas afecta
2. Mostrar al usuario una muestra de filas afectadas (`SELECT name, status, ... LIMIT 10`)
3. Obtener confirmación explícita del usuario antes de ejecutar
4. Ejecutar el UPDATE
5. Ejecutar SELECT COUNT(*) post-update para confirmar

**Incidente real (2026-07-04/05):** El agente ejecutó `UPDATE leads SET status = lower(status)` sin previa autorización para "arreglar filtros de marketing". Esto silenciosamente:
- Rompió el trigger de `internal_won_date` → fechas de cierre erróneas para 182 leads
- Vació el embudo de ventas del dashboard (el RPC usa TitleCase estricto)
- Corrompió la gráfica "Tendencia de Ventas" con datos incorrectos
- Requirió 4+ horas de diagnóstico y corrección manual con riesgo legal

---

## Historial de incidentes

| Fecha | Causa | Horas perdidas | Regla que lo previene |
|-------|-------|---------------|----------------------|
| 2026-05-15 | RPC `set_autonomy_level` sin función SQL | ~5 horas | Regla 1 |
| 2026-05-15 | Navegó a proyecto `ikofyypxphrqkncimszt` incorrecto | incluidas arriba | Regla 6 |
| 2026-05-08 | `ai_score` en SELECT sin existir en prod | desconocido | Regla 3 |
| 2026-05-30 | Enlace externo a Google Calendar para editar reuniones | Varias horas | Regla 7 |
| 2026-06-04 | Subagente ejecutó SQL en `ikofyypxphrqkncimszt` (Edge Functions) creyendo que era CRM | tiempo real | Regla 8 |
| 2026-06-08 | `DROP FUNCTION get_auth_company_id() CASCADE` borró políticas RLS de `client_stage_document_types` y `client_documents` sin que la migración de restore las recuperara | ~3 días invisible | Regla 10 |
| 2026-06-08 | `get_auth_company_id()` fue reescrita para leer del JWT en vez de `profiles`. JWT sin `company_id` → BD invisible para todos | ~3 días | Regla 9 |
| 2026-06-11 | Agente aplicó fix en producción sin autorización explícita del usuario | horas de tensión | Regla 5 — Gate de autorización |
| 2026-06-14 | `git checkout` accidental borró cambios avanzados sin confirmar | ~2 horas (reconstrucción) | Regla 11 |
| 2026-06-23 | Agente creó tablas `lead_marketing_stats` y `login_attempts` sin habilitar RLS | vulnerabilidad de datos | Regla 12 — RLS Obligatorio |
| **2026-07-04** | **Agente normalizó `leads.status` a minúscula sin autorización. Rompió trigger `internal_won_date`, embudo de ventas y tendencia de ingresos para 182 leads. Requirió corrección manual con riesgo legal para el cliente.** | **~1 día** | **Regla 13 — Status TitleCase** |

