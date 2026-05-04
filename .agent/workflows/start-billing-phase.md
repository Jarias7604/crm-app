# 🚀 Protocolo de Reanudación: Fase 7 (Billing & SaaS Onboarding)

**Destino:** Agente de Inteligencia Artificial (Antigravity / Gemini)
**Proyecto:** Arias CRM / EcclesiaCloud (Multi-Tenant SaaS)
**Estado Actual del Repositorio:** Rama `develop` (Todo respaldado y estable).

---

## 🛑 1. Contexto de la Última Sesión (No investigar, leer aquí)
El usuario y el agente completaron exitosamente dos cirugías mayores en el código:
1. **Fase 3 Completada:** Se implementó el `GlobalSearch` (Omni-Buscador) con análisis de Inteligencia Artificial en tiempo real para Leads y Seguimientos.
2. **Fase 4 Completada (Modular CRUD Engine):** El archivo monolítico `Leads.tsx` fue desintegrado con éxito de 3,000 líneas a ~1,600 líneas.
   * Se extrajeron al "Estándar de Oro": `<LeadTable />`, `<LeadGrid />`, y `<LeadToolbar />`.
   * El sistema compila con CERO errores (`Exit Code 0`).

---

## 🎯 2. Misión Inmediata (Fase 7: Billing & Onboarding)
El enfoque arquitectónico **ha cambiado exclusivamente a la comercialización del SaaS**. No optimizar más vistas hasta tener la pasarela de pagos.

### Tareas Prioritarias para esta Sesión:
1. **Stripe & Modelos de Datos:** Revisar o crear la tabla `company_subscriptions` en Supabase para manejar (Plan Starter, Pro, Enterprise).
2. **Self-Service Onboarding:** Crear el *Wizard* de bienvenida para que las nuevas empresas/iglesias se registren solas, añadan su logo y paguen sin intervención humana.
3. **Paywalls (Muros de Pago):** Crear bloqueos condicionales en el código. (Ej. Si intentan usar el Agente de IA y su plan es "Starter", mostrar modal para hacer *Upgrade*).

---

## 🗺️ 3. El Roadmap Restante (Para contexto del Agente)
Si se termina la Fase 7, el orden de ataque acordado es:
* **Fase 5 (Reporting):** Dashboards ROI para el cliente + Panel Super Admin para Arias Defense.
* **Fase 6 (Integraciones):** Webhooks, Zapier, Google Calendar.
* **Fase 8 (Knowledge Base):** Centro de ayuda Self-Service incrustado en el CRM.

---

## ⚠️ 4. Reglas Estrictas de Operación
1. **Git Flow:** Trabajar SIEMPRE en la rama `develop`. No hacer push a `main` sin estabilización previa.
2. **Modularidad:** Todo componente nuevo de facturación u Onboarding debe ser modular (Estándar de Oro).
3. **Aesthetic UI:** Mantener el diseño *Premium Glassmorphism* en las pasarelas de pago y Onboarding. Tiene que verse costoso y profesional.

**[INSTRUCCIÓN PARA EL AGENTE]:** Al leer este documento, confirma al usuario que estás listo para iniciar la "Fase 7: Billing" y pregúntale si prefieres empezar por la Base de Datos (Supabase `company_subscriptions`) o por las Pantallas (Onboarding UI).
