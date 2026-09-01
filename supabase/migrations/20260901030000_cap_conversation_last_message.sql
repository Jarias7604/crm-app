-- ============================================================
-- Cap marketing_conversations.last_message to a short preview
-- 2026-09-01
--
-- Context: the email integration was storing the ENTIRE HTML email body
-- (up to ~2 MB) in `last_message`, a field meant to hold a one-line preview.
-- 57 rows had grown the table to 57 MB. Every `unread_count` UPDATE rewrote
-- a multi-MB row (~2.3s each) and SELECT * on the table pulled 50+ MB.
--
-- Full message bodies are unaffected — they live in marketing_messages.content.
--
-- This migration was ALSO applied directly to production (mtxqqamitglhehaktgxm)
-- on 2026-09-01 because the CI migrate-production job has been failing since
-- ~2026-07-01. It is idempotent.
-- ============================================================

-- 1. One-time backfill of existing bloated previews
UPDATE public.marketing_conversations
SET last_message = trim(left(
        regexp_replace(
          regexp_replace(
            regexp_replace(last_message, '<[^>]+>', ' ', 'g'),
          '&[a-z]+;', ' ', 'g'),
        '\s+', ' ', 'g'),
    300))
WHERE last_message IS NOT NULL
  AND length(last_message) > 350;

-- 2. Trigger to keep it capped going forward
CREATE OR REPLACE FUNCTION public.cap_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.last_message IS NOT NULL AND length(NEW.last_message) > 500 THEN
        NEW.last_message := trim(left(
            regexp_replace(regexp_replace(NEW.last_message, '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g'),
            300));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cap_last_message ON public.marketing_conversations;
CREATE TRIGGER trg_cap_last_message
    BEFORE INSERT OR UPDATE OF last_message ON public.marketing_conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.cap_conversation_last_message();
