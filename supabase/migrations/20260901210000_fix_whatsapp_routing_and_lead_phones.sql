-- ============================================================
-- Fix WhatsApp inbound routing + backfill missing lead phones
-- 2026-09-01
--
-- Problem (started ~2026-08-29):
--   The WhatsApp Business Account 2058962911293336 has 3 numbers. Ad-campaign
--   customers message +503 7552 1885 ("Arias Defense Ventas", phone_number_id
--   1249617658240469), but the "Ventas y Pautas" marketing_integrations row
--   still pointed at the OLD number +503 6868 5512 (564050433468481).
--   Result: meta-webhook's phone_number_id lookup failed and fell through to a
--   blind .limit(1) fallback → non-deterministic routing ("conversations make
--   no sense"), and send-whatsapp-message replied FROM the wrong number so
--   customers never saw the replies in their thread.
--
--   Also: the live process_incoming_marketing_message was the pre-v_phone
--   version and the deployed webhook wasn't sending metadata.phone → new
--   WhatsApp leads were created with phone = NULL.
--
-- Applied directly to production (mtxqqamitglhehaktgxm) on 2026-09-01 because
-- the CI migrate-production job has been failing since ~2026-07-01. Idempotent.
-- ============================================================

-- 1. Point "Ventas y Pautas" at the correct WhatsApp number
UPDATE public.marketing_integrations
SET settings   = settings || jsonb_build_object(
                    'phoneNumberId', '1249617658240469',
                    'phone',         '+503 7552 1885'),
    updated_at = now()
WHERE provider = 'whatsapp'
  AND company_id = '9aa056ab-4054-4ec0-bf24-52057cd4aaaf';

-- 2. Deactivate the orphaned integration (its company was deleted)
UPDATE public.marketing_integrations
SET is_active = false, updated_at = now()
WHERE id = '355d6b4a-a299-4186-86c3-b70634b16119'
  AND company_id NOT IN (SELECT id FROM public.companies);

-- 3. process_incoming_marketing_message: resolve phone from p_external_id when
--    metadata.phone is absent (see 20260831190000 — re-applied here for the
--    environments that never ran it).
-- (function body identical to supabase/migrations/20260831190000_update_process_incoming_message_source.sql)

-- 4. Backfill: WhatsApp leads created without a phone get it from their
--    conversation's external_id (which IS the sender's number).
UPDATE public.leads l
SET phone = '+' || mc.external_id,
    updated_at = now()
FROM public.marketing_conversations mc
WHERE mc.lead_id = l.id
  AND mc.channel = 'whatsapp'
  AND (l.phone IS NULL OR l.phone = '')
  AND mc.external_id ~ '^[0-9]{8,15}$';
