# 🤖 AI Roadmap — Features de Inteligencia Artificial

> Fecha: 17 Febrero 2026

---

## Estado Actual (ya implementado ✅)

| Feature | Estado | Tecnología | Dónde |
|---|---|---|---|
| AI Chat Bot (ventas) | ✅ Producción | GPT-4o + OpenAI | `ai-chat-processor` edge function |
| Transcripción de voz | ✅ Producción | Whisper API | Dentro de `ai-chat-processor` |
| Cotización automática AI | ✅ Producción | GPT-4o + QUOTE_TRIGGER | Edge function |
| Lead Discovery | ✅ Producción | Google Places API | `search-businesses` edge function |
| Telegram Bot bidireccional | ✅ Producción | Telegram API | `telegram-webhook` edge function |
| System prompt configurable | ✅ Producción | `marketing_ai_agents` table | Admin UI |

---

## Feature 1: Meeting Intelligence (Prioridad ALTA)

### Concepto
El vendedor graba reuniones en Zoom/Meet/Teams, sube la grabación al CRM, y la AI genera un reporte completo.

### Qué genera la AI:
- Transcripción completa con speaker ID (quién dijo qué)
- Resumen ejecutivo
- Highlights con timestamps
- Action items con responsables y fechas
- Score de sentimiento de la venta
- Email borrador post-reunión

### Stack técnico:
- **AssemblyAI** — Transcripción + Speaker Diarization + Summary ($0.0028/min)
- **GPT-4o** — Análisis profundo + action items ($0.02/reunión)
- **Supabase Storage** — Almacenamiento de grabaciones ($0.021/GB)

### Costo estimado: 200 reuniones/mes
| Componente | Costo |
|---|---|
| AssemblyAI (transcripción + speakers) | $17/mes |
| GPT-4o (análisis) | $4/mes |
| Storage | $6/mes |
| **Total** | **~$30/mes** |

### Créditos gratuitos:
- AssemblyAI: 185 horas gratis (cubre ~3 meses)
- Total primeros meses: ~$4/mes (solo GPT-4o)

### Tiempo de desarrollo: ~10 días
| Fase | Tiempo |
|---|---|
| DB schema (meetings, transcripts, reports) | 1 día |
| Upload de grabaciones + Supabase Storage | 1 día |
| Edge Function `meeting-processor` | 3 días |
| UI de reportes con highlights y player | 2 días |
| Auto-sync con leads/follow-ups | 1.5 días |
| Permisos por rol + coaching dashboard | 1.5 días |

### Diferenciador clave:
- HubSpot: Meeting Intelligence solo en Enterprise ($150/usr/mes)
- Tu CRM: Incluido en Professional ($35/usr/mes)
- Costo real: $0.03 por reunión

---

## Feature 2: Call AI — Auto-fill CRM desde llamadas (Prioridad MEDIA)

### Concepto
La AI escucha llamadas telefónicas del vendedor y automáticamente llena el CRM, crea follow-ups, y redacta emails.

### Opciones evaluadas:

| Opción | Costo/mes (7,200 min) | Qué hace |
|---|---|---|
| **A. Retell AI Full** | ~$1,300 | AI habla con el cliente + llena CRM |
| **B. Solo escucha** | ~$187 | Transcribe llamada + llena CRM auto |
| **C. Híbrida** | ~$936 | AI atiende + vendedor interviene |

### Recomendación: Opción B (Solo escucha) — $187/mes
- Vendedor hace su llamada normal
- AI transcribe en background (Whisper: $0.006/min)
- GPT-4o extrae datos y ejecuta acciones automáticas

### Stack técnico:
- Retell AI o Twilio para captura de audio
- Whisper API para transcripción
- GPT-4o para análisis y extracción de entidades
- Edge Function `call-processor`

### Tiempo de desarrollo: ~8 días

### Prerequisito: Definir cómo se graban las llamadas actualmente

---

## Feature 3: Coaching AI para Gerentes (Prioridad BAJA)

### Concepto
Dashboard que muestra métricas AI por vendedor basadas en sus reuniones y llamadas.

### Métricas:
- % del tiempo que habla el vendedor vs cliente (ideal: 40/60)
- % de reuniones con action items documentados
- Score promedio de sentimiento
- Correlación: reuniones con buen score → conversiones
- Objeciones más comunes detectadas

### Dependencia: Requiere Meeting Intelligence implementado primero

### Tiempo de desarrollo: ~3 días adicionales

---

## Comparativa vs Competencia (Features AI)

| Feature AI | HubSpot | Workforce | Fireflies ($18/usr) | Tu CRM |
|---|---|---|---|---|
| AI Chat Bot ventas | ❌ | ❌ | ❌ | ✅ Ya funciona |
| Cotización automática AI | ❌ | ❌ | ❌ | ✅ Ya funciona |
| Meeting transcription | Solo Enterprise | ❌ | ✅ | ✅ ~$30/mes |
| Speaker identification | Solo Enterprise | ❌ | ⚠️ Fallos | ✅ AssemblyAI 95% |
| Auto-fill CRM post-reunión | ❌ | ❌ | ❌ | ✅ Planificado |
| Action items → CRM follow-ups | ❌ | ❌ | ❌ | ✅ Planificado |
| Deal sentiment analysis | ❌ | ❌ | ❌ | ✅ Planificado |
| Sin bot intrusivo | N/A | N/A | 🤮 Bot visible | ✅ Ghost Mode |
| Español nativo | ⚠️ | ⚠️ | ⚠️ | ✅ Completo |
