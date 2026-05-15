---
description: Flujo oficial de git y despliegues — Local → Testing → Producción
---

# 🔀 Flujo de Despliegue — crm-app

## ⚠️ MAPA DE AMBIENTES — LEER ANTES DE CADA DEPLOY

```
LOCAL (tu PC)
  ↓  trabaja aquí, codifica y prueba rápido
TESTING / DESARROLLO (crm-app-testing)
  ↓  pruebas reales antes de subir a clientes
PRODUCCIÓN (Jarias7604's Project)
  ↓  clientes reales — solo cuando el usuario lo autoriza
```

| Ambiente | Supabase Project | Supabase ID | Vercel | Quién lo usa |
|---|---|---|---|---|
| **Testing/Dev** | crm-app-testing | `ubqscyfefgfbmndnypbp` | Preview URL | El equipo, para pruebas |
| **Producción** | Jarias7604's Project | `ikofyypxphrqkncimszt` | URL pública | Clientes reales |

> ❌ **NO EXISTE** un proyecto "ERP El Salvador" (`npfaqtairvdvtikfonnj`) para este flujo — es otro sistema completamente diferente. Ignorarlo siempre.

---

## 📋 Flujo Normal de Trabajo

### Paso 1 — Trabajar en rama develop (local)
```bash
git checkout develop
# ... hacer cambios en código ...
git add .
git commit -m "feat: descripción del cambio"
git push origin develop
```

### Paso 2 — Deploy a Testing (Supabase + Vercel Preview)
```bash
# Edge Functions a testing:
npx supabase functions deploy <nombre-funcion> --project-ref ubqscyfefgfbmndnypbp --no-verify-jwt

# Frontend → automático via Vercel cuando push a develop
```

### Paso 3 — Pruebas en testing ✅ → Usuario aprueba → Producción
Solo cuando el usuario dice explícitamente **"ponlo en producción"**:
```bash
# Merge develop → main
git checkout main
git merge develop --no-edit
git push origin main

# Edge Functions a producción:
npx supabase functions deploy <nombre-funcion> --project-ref ikofyypxphrqkncimszt --no-verify-jwt
```

---

## 🚨 Reglas para el Agente (NUNCA VIOLAR)

1. **Edge Functions en testing primero** → `--project-ref ubqscyfefgfbmndnypbp`
2. **Edge Functions en producción** → `--project-ref ikofyypxphrqkncimszt` — **solo si el usuario lo pide**
3. **Si el usuario dice "ponlo en producción" o "procede"** → IR A PRODUCCIÓN sin dudar
4. **Nunca confundir `npfaqtairvdvtikfonnj` (ERP El Salvador)** — ese proyecto no tiene nada que ver con el CRM
5. **Siempre sincronizar develop con main después de un hotfix:**
   ```bash
   git checkout develop
   git merge main --no-edit
   git push origin develop
   git checkout main
   ```

---

## ⚡ Registro de Deploy — Hoy (2026-05-14)

| Función | Ambiente | Estado | Cambios |
|---|---|---|---|
| `auto-followup` | PRODUCCIÓN (`ikofyypxphrqkncimszt`) | ✅ Deployed | v4 — GPT-4o contextual, respeta contacto manual de agentes |
| `ai-chat-processor` | PRODUCCIÓN (`ikofyypxphrqkncimszt`) | ✅ Deployed | Guarda email, quote_created_at, demo_scheduled_at en memoria |

**Autorizado por:** Usuario — "si tiene que hacer algo en supabase o vercel hacerlo tu mismo" + "procede"
