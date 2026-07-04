---
description: Pendientes priorizados del CRM — retomar en próxima sesión
---

# ✅ Sesión: Alineación de Ambientes — COMPLETADA (Julio 4, 2026)

**Estado final de los 3 ambientes:**
| Ambiente | Project Ref | Estado |
|---|---|---|
| 🟢 **PRODUCCIÓN** | `mtxqqamitglhehaktgxm` | Activo. Datos reales Arias Defense. Diana/Patricia/Gerson/Melvin. |
| 🟢 **LOCAL/TESTING** | `ubqscyfefgfbmndnypbp` | ✅ SINCRONIZADO — 100/100 migraciones aplicadas, 34/34 Edge Functions desplegadas |
| 🗄️ **Edge Fn Hub** | `ikofyypxphrqkncimszt` | Solo para Edge Functions legacy. Sin datos CRM. |

**`.env.local` apunta a Testing** — correcto. Nunca tocar producción desde local.

**Qué se hizo:**
1. ✅ Verificado: Testing ya tenía 100/100 migraciones iguales a Producción (schema idéntico)
2. ✅ Deploadas 16 Edge Functions faltantes a Testing: `admin-reset-password, auto-followup, dispatch-webhooks, search-businesses, marketing-engine, publish-facebook, publish-instagram, stripe-webhook, score-leads, on-user-login, lead-nurture, tracking, setup-telegram, process-message-queue, ai-chat-processor, meta-oauth`
3. ✅ Sincronizado secret `GOOGLE_PLACES_API_KEY` en Testing
4. ✅ `npm run dev` → localhost:5174 funciona, sin errores de consola

**PRÓXIMOS PENDIENTES (si aplica):**
- Crear un usuario de prueba en Testing para desarrollar sin tocar datos de producción
- Continuar con features normales del CRM

# Sesión: Pipeline Clientes — Bug Fix + Inline Edit (Abril 6, 2026)

**Logros de la Sesión:**
1. **Fix bug "Error al agregar" en PROD/DEV:** La función `auto_set_company_id()` y sus triggers (`trg_auto_company_id`) existían en DEV pero faltaban en PRODUCCIÓN. Al insertar un subdocumento sin `company_id`, la RLS lo rechazaba. Se aplicó migración `fix_auto_company_id_trigger_pipeline_docs` directamente en producción (`ikofyypxphrqkncimszt`). Ahora agregar/crear documentos funciona en todos los ambientes.
2. **Edición inline de documentos de etapa:** Se agregó edición inline en `PipelineConfig.tsx`. Hover sobre un documento → aparece ✏️ → clic → fila se convierte en inputs pre-rellenados (nombre, descripción, checkbox Req.) + botones Guardar/Cancelar. Deploado en `develop` y `main`.

**Estado del Deploy (Abril 6):**
- `develop` → `935fe7f` ✅
- `main` → `c3479e1` ✅
- `develop` y `main` sincronizados ✅

# Sesión Anterior: Manual Maestro y NLP Chatbot (Marzo 28)

**Logros de la Sesión:**
1. **Rediseño Premium del Manual:** Se compactaron los márgenes y centrado adoptando una lectura tipo *Stripe* con renderizado de vectores y componentes Glassmorphism. Se agregó un buscador en tiempo real en la cabecera del manual.
2. **Navegabilidad:** Se integró un botón de escape "Volver al CRM" conectado globalmente a la ruta `/` en la esquina superior.
3. **Cerebro "Local RAG" para HelpChat:** Como la Edge Function `help_chat` no estaba configurada, se reemplazó el mecanismo de error (404) por un Procesador de Lenguaje Natural (NLP) insertado en `api.ts`.
4. **Alimentación Dinámica:** Este Cerebro RAG funciona conectándose al archivo `content.md`. Lee, disecciona en módulos, puntúa palabras clave del usuario, extrae las indicaciones puras (vía RegExp) y contesta a costa $0.
5. **Expansión de Conocimiento:** Se crearon capítulos nuevos directamente en `content.md` sobre "Calendario", "Telegram (Fase 8d)" y "Webhooks Meta". El bot memorizó esto al instante sin requerir entrenamiento.

**Siguiente Reto en la Próxima Sesión:**
- **Alineación de Ambientes (Limpieza de Arquitectura) [CRÍTICO]:**
  - Actualmente, el entorno local conecta a `ikofyypxphrqkncimszt` (etiquetado como "CRM App Production" en el panel) debido a un OpenAI API key inválido en `crm-app-testing`.
  - Debemos corregir la API Key de OpenAI en el proyecto online de pruebas (`ubqscyfefgfbmndnypbp` / `crm-app-testing`).
  - Re-apuntar las variables de entorno `.env.local` al ambiente de pruebas oficial (`crm-app-testing`) para restablecer las mejores prácticas de arquitectura de 3 ambientes (Local, Testing, Producción).
- **Manual del Usuario:** Seguir enriqueciendo `content.md` con nuevos módulos conforme se liberen nuevas versiones del CRM. Específicamente agregar capítulos para el Módulo de Clientes, Pipeline y Permisos.
