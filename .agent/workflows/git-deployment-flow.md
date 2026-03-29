---
description: Flujo oficial de git y despliegues — Local → Develop → Producción
---

# 🔀 Flujo de Despliegue — crm-app

## Arquitectura de Ambientes

```
LOCAL (tu PC)
  ↓  trabaja aquí, prueba rápido
develop (rama git)
  ↓  Vercel Preview → DB de DEV → pruebas reales
main (rama git)
  ↓  Vercel Production → DB de PROD → clientes
```

| Rama | Supabase | Vercel | Quién la usa |
|---|---|---|---|
| `develop` | `mtxqqamitglhehaktgxm` (DEV) | Preview URL | Tú, para probar |
| `main` | `ikofyypxphrqkncimszt` (PROD) | URL pública | Clientes |

---

## 📋 Flujo Normal de Trabajo (Feature / Mejora)

### Paso 1 — Trabajar en develop
```
git checkout develop
```
El agente debe estar en `develop` para todo trabajo nuevo.

### Paso 2 — Hacer cambios y commit
```
git add .
git commit -m "feat: descripción del cambio"
```

### Paso 3 — Push a develop → prueba en Vercel Preview
```
git push origin develop
```
Vercel genera automáticamente una URL de Preview conectada a la DB de DEV.
Probar ahí antes de subir a producción.

### Paso 4 — Cuando las pruebas pasan → merge a main
```
git checkout main
git merge develop --no-edit
git push origin main
```
Esto activa el deploy de producción en Vercel automáticamente.

---

## 🚨 Reglas para el Agente

1. **El agente SIEMPRE trabaja en `develop`** — nunca directamente en `main`
2. **Excepción hotfix:** Si es una corrección crítica de seguridad urgente (como hoy), se puede ir directo a `main` con aprobación explícita del usuario
3. **Después de un hotfix directo a main:** Inmediatamente sincronizar `develop` con `main`:
   ```
   git checkout develop
   git merge main --no-edit
   git push origin develop
   git checkout main
   ```
4. **Nunca hacer `git push origin main` sin confirmar con el usuario primero**

---

## ⚡ Hotfix de Emergencia (como hoy 2026-03-29)

Cuando hay un bug crítico en producción:

```
# Corregir directo en main
git checkout main
# ... hacer cambios ...
git commit -m "fix: descripción urgente"
git push origin main   ← requiere aprobación del usuario

# Inmediatamente sincronizar develop
git checkout develop
git merge main --no-edit
git push origin develop
git checkout main      ← volver a main
```

---

## 📌 Estado actual (2026-03-29)

- `main` y `develop` están sincronizados ✅
- `develop` push → Vercel Preview URL (DEV DB)
- `main` push → Vercel Production (PROD DB con los 532+ leads de Arias Defense)
