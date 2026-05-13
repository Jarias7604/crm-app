# 🤖 Arias Defense AI — Pendientes del Sistema Autónomo
> Última actualización: 13 Mayo 2026 — Sesión matutina
> Para retomar: "Lee PENDIENTES_AI_SYSTEM.md y procede con el primer ítem de Corto Plazo"

---

## ✅ COMPLETADO (esta sesión)

- [x] Sistema de memoria persistente por lead (`lead_ai_memory`)
- [x] Sofía califica antes de cotizar (system prompt maestro)
- [x] Sentiment engine v2 — scoring real en español con historial acumulativo
- [x] Auto-followup v2 — lee settings dinámicos de DB (`ai_followup_settings`)
- [x] **BUG FIX CRÍTICO** — status filter `open` → `active` (ahora SÍ funciona)
- [x] Cron `pg_cron` cada 4 horas — auto-followup sin intervención humana
- [x] UI de configuración dinámica `/marketing/followup-settings`
- [x] Tooltips `?` en métricas del Cockpit con explicación en hover
- [x] Sync automático AI stage ↔ CRM `leads.status`
- [x] Escalación automática: agotó intentos → notifica agente por Telegram
- [x] Detección de cierre de venta → alerta al agente asignado por Telegram
- [x] Panel "Objeciones de Precio" — slider descuento + botón Enviar Oferta
- [x] Detección enriquecida de objeciones (guarda texto exacto + fecha + plan cotizado)
- [x] Botón 🗑️ "Borrar Memoria" por lead en el Cockpit
- [x] Pestaña "Escalar" en el Cockpit con cola de escalaciones
- [x] Manual v5.0 — sección completa del Cockpit AI documentada
- [x] `UserProfileModal` — cada agente agrega su `telegram_chat_id` desde su perfil

---

## ✅ CORTO PLAZO — COMPLETADO (13 Mayo 2026)

- [x] **Fix `force_lead_id` en auto-followup** — botón "Enviar Oferta" ahora funciona. Edge function detecta `force_lead_id` + `custom_message`, salta todos los filtros y envía el mensaje directo al lead por su canal nativo.
- [x] **WhatsApp channel detection** — `auto-followup` v3 detecta `conv.channel`. Si es `whatsapp` → llama `sendWhatsAppMessage()` via Meta Cloud API. Si es `telegram` → flujo existente. Código listo, solo falta configurar secrets (ver abajo).
- [x] **Recálculo de sentiment histórico** — Script SQL en `supabase/migrations/20260513_recalculate_historical_sentiment.sql`. Ejecutar una vez en consola SQL de Supabase.

### ⚙️ Para activar WhatsApp cuando tengas las credenciales:
```bash
# 1. Obtener de Meta Business Manager → WhatsApp → API Setup
npx supabase secrets set WHATSAPP_PHONE_NUMBER_ID=<tu_phone_number_id> --project-ref ikofyypxphrqkncimszt
npx supabase secrets set WHATSAPP_TOKEN=<tu_token_permanente> --project-ref ikofyypxphrqkncimszt

# 2. Redeploy para que tome los nuevos secrets
npx supabase functions deploy auto-followup --project-ref ikofyypxphrqkncimszt --no-verify-jwt
```
No es necesario cambiar ningún código — el sistema detecta automáticamente si los secrets están configurados.

---

## 🟡 MEDIANO PLAZO (próximas semanas)

### 4. Reporte de conversiones del bot (~2h)
- Vista en el Cockpit: de X leads que Sofía atendió, Y% cerraron
- ROI calculado: ingresos generados vs costo del sistema ($0 APIs)
- Tabla con: lead, plan contratado, fecha cierre, agente que cerró

### 5. A/B testing de templates de seguimiento (~3h)
- Template A vs Template B en la config de seguimientos
- Sistema alterna automáticamente entre templates
- Registra qué template generó más respuestas/cierres
- Dashboard de estadísticas en FollowupSettings UI

### 6. Panel de análisis de objeciones (~1h)
- Agrupación automática: "precio" / "necesita aprobación" / "no es prioridad"
- % de cada tipo que cierra finalmente
- Gráfico de tendencia por semana

---

## 🟢 LARGO PLAZO (Fase 4 — Sofía 2.0)

### 7. Sofía aprende de cierres exitosos
- Cuando lead.status → "Cliente", analizar qué mensaje/técnica funcionó
- Incorporar ese patrón al system prompt dinámicamente
- Base de datos de "frases que cierran"

### 8. Integración con sistema de facturación
- Al confirmar cierre en CRM → generar cotización automática
- Enviar PDF al cliente por Telegram con link de pago
- Notificar contabilidad

### 9. Sofía multi-idioma
- Detectar idioma del lead en primer mensaje
- Si inglés → responder en inglés con pricing en USD
- Si español → flujo actual

---

## 📌 Contexto técnico para retomar

```
Proyecto Supabase:     mtxqqamitglhehaktgxm (DEV/PROD)
Edge Functions:        ai-chat-processor, auto-followup
Tabla configuración:   ai_followup_settings
Tabla memoria:         lead_ai_memory
Vista métricas:        agent_cockpit_metrics
Cron job:              ai-auto-followup-every-4h (cada 4h)
UI Cockpit:            /marketing/cockpit
UI Config:             /marketing/followup-settings
```

## 🔑 Frase para retomar sesión mañana

> "Lee .agent/PENDIENTES_AI_SYSTEM.md y procede con el primer ítem pendiente de Corto Plazo"

