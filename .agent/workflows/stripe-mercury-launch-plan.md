---
description: Plan de Integración de Stripe USA + Mercury Bank para Cobro de Suscripciones SaaS
---

# 💳 Plan de Integración: Stripe USA + Mercury Bank (SaaS Billing)

> **ESTADO:** Planificado y documentado para ejecución cuando el usuario lo indique.  
> **FECHA DE CREACIÓN:** 29 de Agosto de 2026.

---

## 🏛️ 1. Arquitectura Financiera y Legal

- **Entidad Legal:** Empresa en USA (con EIN del IRS activo).
- **Cuenta Bancaria:** Mercury Bank (USA - USD).
- **Clientes Destino:** El Salvador y Latinoamérica (pagan con tarjetas locales e internacionales en USD).
- **Comisiones Stripe USA:** ~4.4% + $0.30 USD por transacción internacional (absorbido dentro del precio de los paquetes).
- **Conversión de Moneda:** 0% (El Salvador opera en USD de curso legal).

---

## 📋 2. Checklist de Ejecución (Paso a Paso)

### Paso 1: Configurar Subcuenta en Stripe
1. Entrar a [dashboard.stripe.com](https://dashboard.stripe.com).
2. Crear nueva subcuenta llamada **Arias CRM** vinculada al mismo EIN de la empresa en USA y misma cuenta de Mercury Bank.
3. En **Product Catalog**, crear los 3 planes recurrentes mensuales:
   - **Starter:** `$29.00 USD/mes`
   - **Pro:** `$79.00 USD/mes`
   - **Enterprise:** `$199.00 USD/mes`
4. En **Settings -> Customer Portal**, activar el portal de autoservicio de clientes.

### Paso 2: Conexión Técnica y Variables de Entorno
- En **Developers -> API Keys**, obtener:
  - `VITE_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- Configurar el Webhook de Stripe apuntando a la Edge Function `stripe-webhook`:
  - URL Testing: `https://ubqscyfefgfbmndnypbp.supabase.co/functions/v1/stripe-webhook`
  - URL Producción: `https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/stripe-webhook`
  - Eventos a escuchar: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.

### Paso 3: Pruebas en Entorno de Testing (QA)
- Probar un upgrade de `trialing` a `active` con tarjeta de prueba en `/company/billing`.
- Verificar que el webhook active los módulos Pro y actualice el contador de cuotas (Leads, AI Tokens).
- Verificar que la factura se visualice en el historial de facturación del cliente.

### Paso 4: Pase a Producción Oficial
- Desplegar el frontend en Vercel (`main`).
- Actualizar secrets de Stripe en Supabase Producción (`mtxqqamitglhehaktgxm`).
- Validar cobro en vivo con tarjeta real.

---

## 💰 Tabla de Precios y Absorción de Comisiones

| Plan | Precio Facturado al Cliente | Tarifa Stripe Estimada (~4.4% + $0.30) | Depósito Neto en Mercury Bank |
|---|---|---|---|
| **Starter** | **$29.00 USD** | $1.58 USD | **$27.42 USD** |
| **Pro** | **$79.00 USD** | $3.78 USD | **$75.22 USD** |
| **Enterprise** | **$199.00 USD** | $9.06 USD | **$189.94 USD** |
