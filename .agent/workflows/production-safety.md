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
| **Edge Functions / AI** | `ikofyypxphrqkncimszt` | `ikofyypxphrqkncimszt` | Sofía, Telegram, Orchestrator, todas las Edge Fn |
| **CRM Producción** | `mtxqqamitglhehaktgxm.supabase.co` | `mtxqqamitglhehaktgxm` | Datos reales: leads, usuarios, cotizaciones |
| **Testing / Local** | `ubqscyfefgfbmndnypbp.supabase.co` | `ubqscyfefgfbmndnypbp` | Activo en `.env.local`. Dev y pruebas |

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

## Historial de incidentes

| Fecha | Causa | Horas perdidas | Regla que lo previene |
|-------|-------|---------------|----------------------|
| 2026-05-15 | RPC `set_autonomy_level` sin función SQL | ~5 horas | Regla 1 |
| 2026-05-15 | Navegó a proyecto `ikofyypxphrqkncimszt` incorrecto | incluidas arriba | Regla 6 |
| 2026-05-08 | `ai_score` en SELECT sin existir en prod | desconocido | Regla 3 |
