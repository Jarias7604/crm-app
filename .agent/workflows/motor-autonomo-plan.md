# Plan Maestro: Motor Autónomo de Ventas — Nivel Dios

> **Proyecto:** Arias Defense CRM (`ikofyypxphrqkncimszt`)  
> **Mañana dile:** "Muéstrame el plan" y continuamos  
> **Fecha:** 15 Mayo 2026

---

## ✅ Ya Funciona HOY

| # | Componente | Edge Function | UI |
|---|---|---|---|
| 1 | Sofía Chat AI (Telegram) | `ai-chat-processor` | ChatHub |
| 2 | Auto-followup Telegram | `auto-followup` | FollowupSettings |
| 3 | Email Nurture (huérfanos + rescate) | `lead-nurture` | — |
| 4 | Motor Config Wizard (4 pasos) | — | `/marketing/engine-config` |
| 5 | AI Cockpit (métricas) | — | `/marketing/cockpit` |
| 6 | Señal de cierre → Telegram alert | `ai-chat-processor` | Cockpit |
| 7 | Lead Memory (cerebro persistente) | — | `lead_ai_memory` table |
| 8 | Objeciones de precio | `ai-chat-processor` | Cockpit |
| 9 | Score leads (existe función) | `score-leads` | — |
| 10 | Send WhatsApp (existe función) | `send-whatsapp-message` | — |
| 11 | Google Calendar sync (existe) | `google-calendar-sync` | Integrations |
| 12 | Email tracking pixel (existe) | `tracking` | — |

---

## 🔥 Lo que FALTA — 7 Fases Detalladas

---

### FASE 1: Conectar Wizard → Email Engine (4 horas)

**Problema:** `lead-nurture` tiene templates hardcodeados. El wizard guarda config pero el CRON no la lee.

**Archivos a modificar:**
- `supabase/functions/lead-nurture/index.ts`

**Pasos exactos:**
1. Al inicio de la función, query `ai_followup_settings` para obtener `nurture_config`
2. Reemplazar subjects/bodies hardcodeados por `nurture_config.steps.s1/s2/s3/rescue`
3. Usar `nurture_config.whatsapp` para generar el CTA link
4. Usar `nurture_config.tone` para el saludo (formal/profesional/directo)
5. Respetar campo `enabled: true/false` — si s2 está desactivado, saltar
6. Redeploy: `supabase functions deploy lead-nurture`

**Verificación:**
- Cambiar un subject en el wizard → guardar → esperar ciclo CRON → verificar que el email usa el nuevo subject
- SQL: `SELECT nurture_config FROM ai_followup_settings WHERE company_id = '7a582ba5...'`

---

### FASE 2: Email Tracking Inteligente (1 día)

**Problema:** No sabemos si el lead abrió el email. Ya existe `tracking` function pero no está conectado.

**Archivos:**
- `supabase/functions/tracking/index.ts` — verificar que funciona
- `supabase/functions/lead-nurture/index.ts` — inyectar pixel

**Pasos:**
1. Revisar `tracking/index.ts` — ¿qué endpoint expone? ¿guarda en qué tabla?
2. En `lead-nurture`, agregar pixel `<img>` invisible al HTML del email:
   ```html
   <img src="https://ikofyypxphrqkncimszt.supabase.co/functions/v1/tracking?lid={lead_id}&step=1" width="1" height="1" />
   ```
3. Guardar `email_opened_at` en `lead_ai_memory.known_facts`
4. En Cockpit: mostrar tasa de apertura como métrica

**Verificación:** Enviar email de test a tu correo → abrir → verificar que `lead_ai_memory` se actualiza

---

### FASE 3: Pipeline Decay Detection (1 día)

**Problema:** Diana tiene leads de 6 días sin contactar. No hay alerta automática.

**Archivos:**
- `supabase/migrations/YYYYMMDD_pipeline_decay_rules.sql` [NEW]
- `supabase/functions/auto-followup/index.ts` — agregar lógica de decay
- `src/pages/marketing/SalesEngineConfig.tsx` — UI para reglas

**Pasos:**
1. Crear tabla `pipeline_decay_rules`:
   - `company_id`, `from_status` (prospecto/contactado/cotizado), `max_days`, `action` (email/call/escalate)
2. En `auto-followup`, después del follow-up normal, query leads estancados:
   ```sql
   SELECT * FROM leads WHERE status = rule.from_status 
   AND updated_at < NOW() - INTERVAL 'X days'
   ```
3. Ejecutar acción: email → trigger `lead-nurture`, escalate → crear tarea al agente
4. UI: sección "Reglas de Decaimiento" en el editor del Motor de Ventas
   - "Si lead en [Prospecto] > [3] días → [Enviar email]"
   - "Si lead en [Cotizado] > [2] días → [Rescate cotización]"

**Verificación:** Crear regla "Prospecto > 1 día → email" → esperar ciclo → verificar envío

---

### FASE 4: Lead Scoring Predictivo (2 días)

**Problema:** Ya existe `score-leads` function pero no usa datos reales de comportamiento.

**Archivos:**
- `supabase/functions/score-leads/index.ts` — refactorizar
- `src/pages/Leads.tsx` — mostrar score visual

**Pasos:**
1. Revisar `score-leads` actual — ¿qué calcula? ¿cómo se dispara?
2. Refactorizar con scoring multi-factor:
   - +20 si abrió email (de `lead_ai_memory.known_facts.email_opened_at`)
   - +30 si respondió en cualquier canal
   - +15 si visitó propuesta pública (del `tracking`)
   - +25 si pidió demo
   - +10 si tiene empresa identificada
   - -10 por cada día sin actividad
   - -20 si expresó objeción de precio
3. CRON diario 3AM para recalcular scores
4. Sofía prioriza leads con score > 70
5. UI: barra de score con color en la grilla de leads

**Verificación:** Abrir leads grid → verificar que scores reflejan actividad real

---

### FASE 5: Call Bot — Sofía Voice (1 semana)

**Problema:** Leads sin email ni Telegram solo se contactan manualmente. Necesitamos que Sofía llame.

**Prerequisito:** Revisar proyecto "Call AI para Erick Roofer" — veo Retell AI en tus bookmarks.

**Archivos:**
- `supabase/functions/sofia-voice-trigger/index.ts` [NEW]
- `src/pages/marketing/SalesEngineConfig.tsx` — activar canal Call Bot
- `src/pages/marketing/AiAgentCockpit.tsx` — mostrar llamadas

**Pasos:**

**5A. Investigar proyecto Erick Roofer (30 min)**
1. Abrir proyecto → revisar estructura, ¿usa Retell AI? ¿Twilio?
2. Identificar: endpoint de llamada, formato de prompt, cómo recibe transcripción
3. Documentar qué se reutiliza vs adaptar

**5B. Crear Edge Function (2 días)**
1. `sofia-voice-trigger/index.ts`:
   - Input: `{ lead_id, trigger_reason, company_id }`
   - Lee datos del lead: nombre, teléfono, empresa, última cotización, historial
   - Genera prompt contextual: "Llama a {nombre} de {empresa}. Última interacción: cotización de DTE hace 3 días..."
   - Dispara llamada via Retell AI API
   - Al terminar: guarda transcripción en `lead_ai_memory.known_facts.call_transcript`
   - Actualiza status del lead según resultado

**5C. Triggers automáticos (1 día)**
1. Agregar al CRON de `auto-followup`:
   - Cotización > 72h sin respuesta + tiene teléfono → llamar
   - Lead score > 85 + sin Telegram/email → llamar
   - Negociación estancada > 5 días → llamar
   - Demo agendada hace 24h → recordatorio por llamada

**5D. Post-llamada (1 día)**
1. Transcripción guardada automáticamente
2. Si lead muestra interés → notificación Telegram al agente
3. Si lead pide cotización → auto-generar y enviar
4. Si lead dice "no me interesa" → marcar como perdido

**5E. UI (1 día)**
1. En `SalesEngineConfig.tsx`: cambiar "Próximamente" → formulario activo
   - Campo: Retell API Key
   - Campo: número de Twilio outbound
   - Toggle: horarios permitidos (L-V 8AM-6PM)
   - Textarea: script base de llamada
2. En Cockpit: sección "Llamadas realizadas" con transcripciones

**Verificación:** Configurar Call Bot → crear lead con solo teléfono → esperar trigger → verificar que llama y guarda transcripción

---

### FASE 6: WhatsApp Outbound (1 semana)

**Problema:** Ya existe `send-whatsapp-message` y `meta-webhook` pero no hay secuencia automática.

**Archivos:**
- `supabase/functions/send-whatsapp-message/index.ts` — revisar estado actual
- `supabase/functions/sofia-whatsapp-outbound/index.ts` [NEW]
- `src/pages/marketing/SalesEngineConfig.tsx` — activar canal

**Pasos:**

**6A. Verificar infraestructura (2h)**
1. Revisar `send-whatsapp-message` — ¿funciona? ¿qué API usa?
2. Revisar `meta-webhook` — ¿recibe mensajes inbound de WhatsApp?
3. ¿Hay WhatsApp Business API configurado? ¿Templates aprobados?

**6B. Templates de WhatsApp (requiere aprobación de Meta)**
1. Template 1: "Hola {nombre}, soy Sofía de {empresa}. Le contactamos sobre {producto}..."
2. Template 2: "Su cotización de {producto} está lista. Revísela aquí: {link}"
3. Template 3: "Última oportunidad — oferta especial válida 48h..."

**6C. Crear secuencia outbound (3 días)**
1. `sofia-whatsapp-outbound/index.ts`:
   - Similar a `lead-nurture` pero envía vía WhatsApp API
   - Solo para leads con teléfono + sin Telegram activo
   - Template aprobado como primer contacto
   - Si responde → Sofía Chat toma el control vía `ai-chat-processor`

**6D. Cascada inteligente de canales (1 día)**
```
¿Tiene email? → Email nurture (3 emails, 7 días)
  └── ¿No abrió ninguno en 5 días?
      ├── ¿Tiene WhatsApp? → Template WhatsApp
      │   └── ¿No respondió 48h? → Call Bot
      └── ¿Solo teléfono? → Call Bot directo
¿No tiene email?
  ├── ¿Tiene WhatsApp? → Template WhatsApp
  └── ¿Solo teléfono? → Call Bot
```
Implementar esta lógica en `auto-followup` como orquestrador central.

**6E. UI**
1. Activar canal "WhatsApp Outbound" en Motor de Ventas
2. Config: API key, número verificado, templates

---

### FASE 7: Autonomía Total — Sofía Cierra Sola (1 semana)

**Archivos:**
- `supabase/functions/ai-chat-processor/index.ts`
- `supabase/functions/google-calendar-sync/index.ts`
- `src/pages/marketing/AiAgentCockpit.tsx`

**7A. Auto-generación de cotización (2 días)**
1. Cuando Sofía califica un lead (BANT completo: volumen, empresa, contacto, presupuesto)
2. Auto-crear cotización en `cotizaciones` con status `pending`
3. Generar link público `/propuesta/{id}`
4. Enviar al lead por su canal activo (Telegram/WhatsApp/Email)
5. Trigger en `ai-chat-processor`: si `conversation_stage === 'calificado'` → crear cotización

**7B. Demo auto-scheduling (2 días)**
1. Ya existe `google-calendar-sync` — verificar estado
2. Sofía ofrece 3 horarios disponibles del calendario del agente
3. Lead elige → crear evento en Google Calendar
4. 24h antes: recordatorio automático (email + WhatsApp/Telegram)
5. Si no confirma → Call Bot como recordatorio

**7C. Smart Re-engagement (1 día)**
1. Leads "perdidos" hace 30-60 días → campaña de reactivación
2. "Hola {nombre}, hace 2 meses nos contactó. Tenemos novedades..."
3. CRON semanal (domingos 10AM)
4. Solo si no marcaron "no contactar"

**7D. Dashboard de ROI del Bot (2 días)**
1. Panel en Cockpit mostrando:
   - Leads contactados: bot vs humano
   - Tasa de respuesta por canal (email vs WA vs llamada vs Telegram)
   - Tiempo promedio de respuesta
   - Revenue atribuido a cada canal
   - Costo: $0 bot vs $X humano por contacto
2. Gráfico de evolución semanal

---

## Orden de Ejecución Recomendado

| Prioridad | Fase | Impacto | Tiempo | Bloqueo |
|---|---|---|---|---|
| 🔴 1 | Conectar wizard → email engine | Alto | 4h | Ninguno |
| 🔴 2 | Pipeline Decay Detection | Alto | 1 día | Ninguno |
| 🔴 3 | Email Tracking | Alto | 1 día | Ninguno |
| 🟡 4 | Lead Scoring Predictivo | Medio | 2 días | Tracking |
| 🟡 5 | Call Bot (Erick Roofer) | Crítico | 1 semana | Revisar proyecto |
| 🟡 6 | WhatsApp Outbound | Alto | 1 semana | Meta API approval |
| 🟢 7 | Autonomía Total | Game changer | 1 semana | Fases 1-6 |

**Tiempo total estimado: 3-4 semanas para tener Sofía vendiendo sola al 100%.**

---

## Arquitectura Final del Sistema

```
         LEAD ENTRA AL CRM
         (Telegram / Manual / Web / WhatsApp)
                    │
         ┌──────────▼──────────┐
         │   SCORING AI (3AM)  │
         │   Score 0-100       │
         └──────────┬──────────┘
                    │
    ┌───────────────▼───────────────┐
    │   CASCADA DE CANALES          │
    │                               │
    │  1. Email Nurture (3 emails)  │
    │  2. WhatsApp Template         │
    │  3. Call Bot (Sofía Voz)      │
    │  4. Tarea manual (último)     │
    └───────────────┬───────────────┘
                    │
    ┌───────────────▼───────────────┐
    │   PIPELINE DECAY RULES        │
    │                               │
    │  Prospecto > 3d → email       │
    │  Cotizado > 48h → rescue      │
    │  Negociación > 5d → call      │
    └───────────────┬───────────────┘
                    │
    ┌───────────────▼───────────────┐
    │   SOFÍA CHAT (Cualquier canal)│
    │                               │
    │  Califica → Auto-cotización   │
    │  Cierre → Agenda demo         │
    │  Objeción → Descuento calc    │
    └───────────────┬───────────────┘
                    │
    ┌───────────────▼───────────────┐
    │   CIERRE                      │
    │                               │
    │  Bot agenda demo automática   │
    │  Humano solo firma y cobra    │
    └───────────────────────────────┘
```
