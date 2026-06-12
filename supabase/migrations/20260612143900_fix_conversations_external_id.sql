-- ================================================================
-- HOTFIX: Reparar conversaciones con external_id = 'internal'
-- Actualiza al número de teléfono del lead (WhatsApp) o notif_{lead_id} (Telegram)
-- Ejecutado en producción: 2026-06-12
-- ================================================================

-- 1. Reparar WhatsApp: asignar el teléfono limpio del lead como external_id
UPDATE marketing_conversations mc
SET external_id = REGEXP_REPLACE(l.phone, '[^0-9]', '', 'g')
FROM leads l
WHERE mc.lead_id = l.id
  AND mc.channel = 'whatsapp'
  AND mc.external_id = 'internal'
  AND l.phone IS NOT NULL
  AND l.phone != '';

-- 2. Reparar Telegram: asignar notif_{lead_id} si tiene lead, o limpiar con timestamp si no
UPDATE marketing_conversations
SET external_id = CONCAT('notif_', lead_id::text)
WHERE channel = 'telegram'
  AND external_id = 'internal'
  AND lead_id IS NOT NULL;

-- 3. Telegram sin lead: asignar identificador único para no bloquear la constraint
UPDATE marketing_conversations
SET external_id = CONCAT('orphan_', id::text)
WHERE external_id = 'internal'
  AND lead_id IS NULL;

-- 4. Verificación final
SELECT id, channel, external_id, lead_id
FROM marketing_conversations
WHERE external_id = 'internal' OR external_id IS NULL;
