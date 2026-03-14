# 🚨 IDENTIDAD DE PROYECTO — LECTURA OBLIGATORIA AL INICIO DE SESIÓN

## ¿QUÉ PROYECTO ES ESTE?
**PROYECTO:** Arias Defense CRM (`crm-app`)
**TIPO:** CRM / SaaS para gestión de leads, cotizaciones y marketing
**CLIENTE:** Arias Defense
**REPOSITORIO:** `Jarias7604/crm-app`
**RUTA LOCAL:** `c:\Users\jaria\OneDrive\DELL\Desktop\crm-app`
**SUPABASE PROJECT:** CRM App (ver `.env.local` para el Project ID)

---

## ❌ LO QUE NO PERTENECE A ESTE PROYECTO

Este proyecto NO es y NO debe contener nada de los siguientes proyectos hermanos:

| Proyecto              | Descripción                                      | Señal de alerta                          |
|-----------------------|--------------------------------------------------|------------------------------------------|
| **ERP El Salvador**   | Sistema ERP con DTE, IVA, Renta, NIIF           | Keywords: `DTE`, `plan_de_cuentas`, `libro_iva`, `partidas_contables`, `Renta`, `NIIF` |
| **GlobalAds AI OS**   | Plataforma SaaS de publicidad y video IA         | Keywords: `BigVU`, `meta-insights`, `ad-creative`, `video-studio` |
| **VisionSaaS**        | Módulo de compras y proveedores El Salvador       | Keywords: `compras`, `proveedores`, `reception`, `purchase_book` |

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

---

## 🔒 PROTOCOLO ANTI-CONTAMINACIÓN

Antes de aplicar CUALQUIER migración SQL, edge function o ajuste de código, el agente DEBE:

1. **Confirmar** que el archivo/funcionalidad corresponde a este proyecto CRM.
2. **Preguntar** si hay duda sobre si algo pertenece aquí o a otro proyecto.
3. **Rechazar** ejecutar migraciones que contengan tablas de ERP (DTE, contabilidad, compras).
4. **Verificar** el Project ID de Supabase en `.env.local` antes de aplicar cualquier `apply_migration`.

---

## 📋 STACK TÉCNICO

- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Backend:** Supabase (PostgreSQL + Edge Functions + Auth + Storage + Realtime)
- **Deploy:** Vercel
- **AI:** OpenAI GPT-4o (cotizaciones, marketing, chat)
- **Idioma del código:** Español (variables, componentes, comentarios)

---

## ⚠️ REGLA DE ORO

> **Si en la conversación se menciona DTE, plan de cuentas, IVA en contexto fiscal ERP, módulo de compras, o NIIF → DETENER y preguntar si es el proyecto correcto antes de tocar nada.**

Última actualización: 2026-03-14
