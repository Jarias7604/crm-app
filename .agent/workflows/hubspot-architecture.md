---
description: Pendientes priorizados del CRM — retomar en próxima sesión
---
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
- **Pipeline:** Implementar el "Botón para revertir etapa de Lead" o "Notificaciones de Telegram (Phase 8d)", considerando que la migración SQL `phase8d` ya se ejecutó exitosamente.
- Seguir enriqueciendo `content.md` con nuevos módulos conforme se liberen nuevas versiones del CRM.
