# 🤖 Arias Defense AI — Pendientes del Sistema Autónomo
> Última actualización: 12 Mayo 2026 — Sesión nocturna
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

## 🔴 CORTO PLAZO — Próxima sesión (en orden de prioridad)

### 1. Fix `force_lead_id` en auto-followup ⚡ (~30 min)
**Qué es:** El botón "Enviar Oferta" en el panel de objeciones de precio ya existe en el UI, pero el edge function `auto-followup` no maneja el parámetro `force_lead_id` todavía. Sin esto, el botón no funciona completamente.
**Qué falta:**
- En `auto-followup/index.ts`: detectar `body.force_lead_id` y `body.custom_message`
- Si viene `force_lead_id`: saltarse todos los filtros y mandar ese mensaje a ese lead específico
- **Archivo:** `supabase/functions/auto-followup/index.ts`

### 2. WhatsApp channel detection en seguimientos (~1h)
**Qué es:** El auto-followup solo envía mensajes por Telegram. Leads que entraron por WhatsApp/Meta Ads no reciben seguimientos automáticos porque el sistema no detecta su canal.
**Qué falta:**
- En `auto-followup/index.ts`: revisar `conversations.channel` del lead
- Si canal = `whatsapp` → enviar por Meta/WhatsApp API en vez de Telegram
- Si canal = `telegram` → seguir como está
- **Archivo:** `supabase/functions/auto-followup/index.ts`

### 3. Recalculo de sentiment para leads históricos (~20 min)
**Qué es:** Los 57 leads actuales tienen sentiment fijo en 50% porque ingresaron antes del nuevo engine. Un script los recalcula usando sus últimos mensajes.
**Qué falta:**
- Script SQL o edge function que lea `marketing_conversations` de cada lead
- Calcule el sentiment en base al último mensaje del lead
- Lo actualice en `lead_ai_memory.sentiment_score`

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

