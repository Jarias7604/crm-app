# Pendientes — Próxima Sesión (Mar 11, 2026)

## ✅ Completado el Mar 10
- Cards comparativas PDF con desglose completo + badges LO QUE PIDIÓ / RECOMENDADO
- Fix `isPagoUnico` en los 4 puntos de renderizado
- PAGO INICIAL inline con desglose itemizado
- Mobile bottom sheet con planes comparativos
- AI Agent auto-detecta plan complementario y guarda `planes_comparativa`
- Migración `planes_comparativa` (JSONB) en cotizaciones — CRM-DEV
- RPC `get_public_proposal` recreado para leer columna nueva
- Commit `88187aa` pusheado a main

## 🔜 Pendientes para próxima sesión

### 1. Edge Function `ai-chat` — Planes comparativos
El `aiQuoteService.ts` (frontend) ya genera cotizaciones con 2 planes.
Pero la Edge Function `supabase/functions/ai-chat/index.ts` probablemente
también genera cotizaciones por su lado cuando el AI responde al lead.
**Revisar si ai-chat usa aiQuoteService o tiene lógica propia.**
Si tiene lógica propia → aplicar el mismo patrón de planes comparativos.

### 2. Footer/diseño PublicQuoteView
El usuario mencionó que "la parte de abajo donde sale la foto" se ve diferente.
Verificar en móvil si la sección del asesor (foto + QR) se ve bien o necesita ajuste.

### 3. Proyectos Supabase — REGLA CRÍTICA
- `mtxqqamitglhehaktgxm` → **CRM-DEV** ← SOLO tocar este
- `ikofyypxphrqkncimszt` → **Jarias7604's Project** ← NO TOCAR (proyecto diferente)
- `npfaqtairvdvtikfonnj` → **ERP El Salvador** ← NO TOCAR

### 4. Testing completo post-deploy
- Nueva cotización creada desde CotizadorPro → verificar `planes_comparativa` guardado
- AI genera cotización → verificar que también guarda `planes_comparativa`
- Link público en móvil muestra 2 tarjetas → ✅ (ya verificado Mar 10)
- PDF descargado desde móvil → verificar tarjetas comparativas
