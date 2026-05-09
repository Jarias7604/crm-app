---
description: Reglas de seguridad para NO romper producción — LEER ANTES DE CADA CAMBIO
---

# 🛡️ Reglas de Seguridad de Producción — OBLIGATORIAS

## REGLA #1: NUNCA agregar columnas nuevas a queries de SELECT

**EL ERROR QUE SIEMPRE NOS MATA:**
Si agregas una columna al `SELECT` de Supabase (ej: `ai_score`), y esa columna NO existe
en la base de datos de PRODUCCIÓN, la query ENTERA falla con 400 y la tabla se ve VACÍA.

**ANTES de agregar CUALQUIER columna a un `.select()` en un service:**
1. Verificar si la columna existe en PRODUCCIÓN (`ikofyypxphrqkncimszt`)
2. Si NO existe → NO agregarla al select. Calcularla client-side.
3. Si la agregas → SIEMPRE usar el patrón SAFE_FIELDS + fallback

## REGLA #2: Patrón SAFE_FIELDS obligatorio

Toda query crítica (getLeads, getTickets, etc.) DEBE tener:
```typescript
const SAFE_FIELDS = '...columnas que EXISTEN en producción...';
const fields = SAFE_FIELDS + ', nuevas_columnas';

const { data, error } = await supabase.from('table').select(fields);

// Si falla, reintentar con SAFE_FIELDS
if (error) {
    const fallback = await supabase.from('table').select(SAFE_FIELDS);
    return fallback.data;
}
```

## REGLA #3: persistLeadScore y similares

Cualquier función que haga UPDATE a columnas nuevas (`ai_score`, etc.):
- DEBE ser fire-and-forget (`.catch(() => {})`)
- NUNCA debe estar en el path crítico de crear/actualizar leads
- Si falla, NO rompe nada

## REGLA #4: Antes de push a main

Checklist mental obligatorio:
- [ ] ¿Agregué alguna columna nueva a un SELECT? → ¿Existe en prod?
- [ ] ¿Agregué un UPDATE a una columna nueva? → ¿Es fire-and-forget?
- [ ] ¿Las queries tienen fallback si la columna no existe?

## Bases de datos por ambiente

| Ambiente | Supabase Project ID | Notas |
|----------|-------------------|-------|
| **PRODUCCIÓN** | `ikofyypxphrqkncimszt` | 532+ leads reales. NO TOCAR. |
| **TESTING/DEV** | `ubqscyfefgfbmndnypbp` | Base de pruebas. OK experimentar. |
| **LOCAL** | Usa TESTING via `.env` | Comparte DB con testing. |

## Historial de incidentes

| Fecha | Causa | Impacto | Fix |
|-------|-------|---------|-----|
| 2026-05-08 | `ai_score` en SELECT | Leads desaparecen en PROD | Removed from query, added fallback |
| (sesión anterior) | 24 columnas faltantes en testing | Leads no cargan en LOCAL | Added columns via SQL migration |
