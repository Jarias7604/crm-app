-- ============================================================
-- DEDUPLICATION: Unique index on WhatsApp message ID (wamid)
-- ============================================================
-- Prevents duplicate AI responses when Meta delivers the same
-- webhook event more than once. This is database-level safety
-- (Nivel 2) — works even if two webhook calls arrive simultaneously.
--
-- HubSpot approach: reject duplicates at DB level, not just code.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_messages_whatsapp_id
  ON marketing_messages ( (metadata->>'whatsapp_id') )
  WHERE metadata->>'whatsapp_id' IS NOT NULL;

-- Log
DO $$
BEGIN
  RAISE NOTICE '✅ WhatsApp message deduplication index created successfully.';
END $$;
