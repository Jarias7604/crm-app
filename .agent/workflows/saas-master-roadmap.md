# 🚀 Protocolo Maestro: Roadmap SaaS (Fases 5 a 8)

**Destino:** Agente de Inteligencia Artificial (Antigravity / Gemini)
**Proyecto:** Arias CRM / EcclesiaCloud (Multi-Tenant SaaS B2B)
**Estado del Repositorio (Último Checkpoint):** Rama `develop` (Fase 3 IA y Fase 4 Modularización completadas con cero errores).

---

## 🛑 1. Estado del Proyecto (Contexto para el Agente)
*   **Fase 3 Completada:** `GlobalSearch` con comandos `/ai` funcionando.
*   **Fase 4 Completada:** `Leads.tsx` fue purificado. Extracción perfecta de `<LeadTable />`, `<LeadGrid />` y `<LeadToolbar />`.
*   **Decisión Arquitectónica:** El CRM ya es operativamente sólido. El enfoque a partir de ahora es 100% comercial: Convertirlo en un producto B2B facturable.

---

## 🗺️ 2. El Plan de Vuelo (Fases Pendientes)

A continuación, la hoja de ruta exacta que el usuario y el arquitecto principal han acordado. **Se debe seguir este orden estrictamente**, empezando por la Fase 7.

### 🥇 PRIORIDAD 1: Fase 7 — Billing & Onboarding (Estado: CRÍTICO)
*El sistema debe poder cobrar automáticamente antes de ofrecer más funcionalidades.*
*   **Módulo de Suscripciones (Supabase):** Implementar la tabla `company_subscriptions` para manejar planes (Starter, Pro, Enterprise).
*   **Integración Stripe:** Configurar pasarela de pagos, facturación recurrente y webhooks de cobros fallidos.
*   **Onboarding Self-Service (Wizard):** Flujo donde el cliente se registra, crea su *Tenant*, sube su logo e ingresa su tarjeta sin intervención manual.
*   **Muros de Pago (Paywalls):** Lógica condicional en el frontend que bloquea módulos premium (ej. Consultor IA) si el *Tenant* no tiene el plan adecuado.
*   **Aplicación de Límites:** Hacer cumplir por código la restricción de `max_users` según el plan pagado.

### 🥈 PRIORIDAD 2: Fase 5 — Reporting Engine & Observabilidad (Estado: ALTO)
*El cliente necesita ver el ROI y el Administrador necesita ver el consumo.*
*   **Customer Dashboards:** Paneles de control altamente visuales y customizables donde las empresas/iglesias vean conversiones, valor del pipeline y velocidad de respuesta.
*   **Super-Admin Dashboard (Observabilidad):** Un panel oculto exclusivo para Arias Defense para monitorear a todos los *Tenants*.
*   **Métricas Core:** Controlar el uso de ancho de banda, espacio de *Storage* y el gasto de Tokens de IA (OpenAI) por cada cliente para proteger los márgenes operativos.

### 🥉 PRIORIDAD 3: Fase 6 — Integraciones & API (Estado: MEDIO/ALTO)
*Hacer que el CRM sea "pegajoso" (Sticky) integrándolo al ecosistema del cliente.*
*   **Webhooks de Salida:** Sistema para disparar eventos (ej. `lead.won`, `quote.sent`) hacia URLs externas.
*   **Integración con Zapier/Make:** Para permitir automatizaciones *no-code* (ej. Si entra un lead, mandar un mensaje a Slack).
*   **Sincronización de Calendarios:** Conexión nativa con Google Calendar / Google Meet para agendar *Follow-ups* directamente desde el CRM.

### 🏅 PRIORIDAD 4: Fase 8 — Knowledge Base (Estado: MEDIO)
*Automatizar el soporte técnico a medida que la base de clientes crezca.*
*   **Portal de Auto-Servicio:** Centro de ayuda incrustado dentro de la aplicación.
*   **Documentación Interactiva:** Tutoriales y guías sobre "¿Cómo configurar WhatsApp?", "¿Cómo agregar vendedores?".
*   **Soporte IA (Chatbot de Ayuda):** Un agente de IA entrenado con la documentación de Arias Defense para responder preguntas técnicas de los usuarios antes de que levanten un ticket.

---

## ⚠️ 3. Reglas Estrictas de Operación para el Agente
1.  **Enfoque de Láser:** Si el usuario invoca este documento, tu meta #1 es **comenzar la FASE 7**. No te desvíes refactorizando código viejo a menos que sea estrictamente necesario para la pasarela de pagos.
2.  **Git Flow Intacto:** Todo desarrollo nuevo se hace en la rama `develop`. Nunca hacer *push* a `main` sin estabilización previa.
3.  **Estándar de Oro de UI:** Todo el flujo de registro y pago debe tener un diseño *Premium Glassmorphism*. La pasarela de pago es donde se gana la confianza del cliente; debe lucir costosa e impecable.

**[INSTRUCCIÓN PARA EL AGENTE]:** Al leer este documento, saluda al usuario, confirma que estás en "Modo Arquitecto de SaaS", y pregúntale directamente: *"¿Iniciamos la Fase 7 estructurando la tabla `company_subscriptions` en Supabase o diseñando las pantallas del Wizard de Onboarding?"*
