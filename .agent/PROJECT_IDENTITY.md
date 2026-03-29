# 🚨 IDENTIDAD DE PROYECTO — LECTURA OBLIGATORIA AL INICIO DE SESIÓN

## ¿QUÉ PROYECTO ES ESTE?
**NOMBRE:** crm-app
**TIPO:** CRM / SaaS para gestión de leads, cotizaciones y marketing
**REPOSITORIO:** `Jarias7604/crm-app`
**RUTA LOCAL:** `c:\Users\jaria\OneDrive\DELL\Desktop\crm-app`

### BASES DE DATOS SUPABASE (INMUTABLES — VERIFICADO VERCEL 2026-03-29)
| Ambiente | Project ID | Vercel env | .env.local |
|---|---|---|---|
| **PRODUCCIÓN** | `ikofyypxphrqkncimszt` | `VITE_SUPABASE_URL` Production | ❌ NO usar |
| **DESARROLLO** | `mtxqqamitglhehaktgxm` | `VITE_SUPABASE_URL` Pre-Production | ✅ sí |

> ⚠️ **TRAMPA CONOCIDA:** Supabase muestra el badge "PRODUCTION" en la rama `main` de CUALQUIER proyecto.
> Ese badge NO indica que sea el proyecto de producción de la app.
> La fuente de verdad es siempre Vercel → Settings → Environment Variables → Production.

### DEPLOY
| Plataforma | URL |
|---|---|
| **Vercel** | `crm-app-v2-jimmy-s-projects-88ff4cb4.vercel.app` |


---

## ⛔ REGLA ABSOLUTA: IDENTIDAD

El nombre de este proyecto es **crm-app** y NADA MÁS.
- **NUNCA** referirse a este proyecto con ningún otro nombre, alias, marca, o etiqueta.
- **NUNCA** traer nombres, contexto, o information de otros proyectos a esta conversación.
- **NUNCA** mezclar Knowledge Items de otros proyectos como si fueran de crm-app.
- **NUNCA** asumir que crm-app tiene otro nombre comercial, de marca, o interno.
- Si el usuario pregunta "¿cómo se llama este proyecto?" → La respuesta es: **crm-app**

**TOLERANCIA A ERRORES DE IDENTIDAD: CERO.**

---

## ❌ LO QUE NO PERTENECE A ESTE PROYECTO

Este proyecto NO es y NO debe contener nada de los siguientes proyectos hermanos:

| Proyecto              | Señal de alerta                          |
|-----------------------|------------------------------------------|
| **ERP El Salvador**   | Keywords: `DTE`, `plan_de_cuentas`, `libro_iva`, `partidas_contables`, `Renta`, `NIIF` |
| **GlobalAds AI OS**   | Keywords: `BigVU`, `meta-insights`, `ad-creative`, `video-studio` |
| **VisionSaaS**        | Keywords: `compras`, `proveedores`, `reception`, `purchase_book` |

---

## ✅ LO QUE SÍ PERTENECE AQUÍ

- **Leads** y su ciclo de vida (Kanban, lista, seguimiento)
- **Cotizaciones** (CotizadorPro, NuevaCotizacion, PublicQuoteView)
- **Marketing** (CampaignBuilder, ChatHub, EmailBuilder, LeadHunter)
- **Teams / Roles / Permisos** (Team.tsx, RBAC, RLS)
- **Audit Log** y actividad de usuarios
- **Dashboard** de métricas CRM
- **Tickets de Soporte** (support module)
- **Configuración Admin** (FinancialRules, Industries, LossReasons, Companies)
- **Calendario** de actividades
- **Notificaciones** de seguimiento

---

## 🔒 PROTOCOLO ANTI-CONTAMINACIÓN

Antes de aplicar CUALQUIER migración SQL, edge function o ajuste de código, el agente DEBE:

1. **Confirmar** que el archivo/funcionalidad corresponde a crm-app.
2. **Preguntar** si hay duda sobre si algo pertenece aquí o a otro proyecto.
3. **Rechazar** ejecutar migraciones que contengan tablas de ERP (DTE, contabilidad, compras).
4. **Verificar** el Project ID de Supabase antes de aplicar cualquier `apply_migration`.
5. **No traer** contexto, patrones, o nombres de KIs que no sean de crm-app.

---

## 📋 STACK TÉCNICO

- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Backend:** Supabase (PostgreSQL + Edge Functions + Auth + Storage + Realtime)
- **Deploy:** Vercel
- **AI:** OpenAI GPT-4o (cotizaciones, marketing, chat)

---

## ⚠️ REGLA DE ORO

> **Si en la conversación se menciona DTE, plan de cuentas, IVA en contexto fiscal ERP, módulo de compras, NIIF, BigVU, video-studio, o GlobalAds → DETENER y preguntar si es el proyecto correcto antes de tocar nada.**

Última actualización: 2026-03-16
