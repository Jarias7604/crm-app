-- =============================================================================
-- Bidirectional Lead <-> Chat WhatsApp status synchronization (SSOT)
-- 1) Trigger keeps tickets.metadata.wa_lead_status synchronized whenever public.leads.status changes.
-- 2) Auto-pauses AI qualifier and closes active lead_qualifier_sessions on Perdido/Erróneo/Cliente/Cerrado.
-- 3) One-time backfill heals all existing desynced leads & chat tickets (incl. Ricardo Cp / non-WA leads).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_lead_status_to_whatsapp_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_terminal boolean;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    v_is_terminal := NEW.status IN ('Perdido', 'Erróneo', 'Cliente', 'Cerrado');

    UPDATE public.tickets
    SET
        updated_at = NOW(),
        metadata = CASE
            WHEN NEW.status = 'Erróneo' THEN
                COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'wa_lead_status', NEW.status,
                    'wa_lead_status_override', true,
                    'ai_qualifier_active', false
                )
            WHEN v_is_terminal THEN
                (COALESCE(metadata, '{}'::jsonb) - 'wa_delivery_error') || jsonb_build_object(
                    'wa_lead_status', NEW.status,
                    'wa_lead_status_override', true,
                    'ai_qualifier_active', false
                )
            ELSE
                (COALESCE(metadata, '{}'::jsonb) - 'wa_delivery_error') || jsonb_build_object(
                    'wa_lead_status', NEW.status,
                    'wa_lead_status_override', true
                )
        END
    WHERE lead_id = NEW.id
      AND COALESCE(metadata->>'source', '') = 'whatsapp_evolution';

    IF v_is_terminal THEN
        UPDATE public.lead_qualifier_sessions
        SET
            status = 'closed_discarded',
            handoff_reason = COALESCE(handoff_reason, 'Etapa de lead actualizada a ' || NEW.status),
            handoff_at = COALESCE(handoff_at, NOW())
        WHERE lead_id = NEW.id
          AND status IN ('active', 'pending_first_touch', 'waiting_reply');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_status_to_tickets ON public.leads;
CREATE TRIGGER trg_sync_lead_status_to_tickets
AFTER UPDATE OF status ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.sync_lead_status_to_whatsapp_tickets();

-- (A) Sync leads that failed WhatsApp delivery ("exists:false" / Sin cuenta de WhatsApp)
-- and still appear in early untouched stages (Prospecto / Llamada fría / En Nutrición).
UPDATE public.leads l
SET
    status = 'Erróneo',
    updated_at = NOW()
WHERE l.status IN ('Prospecto', 'Llamada fría', 'En Nutrición')
  AND EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.lead_id = l.id
        AND COALESCE(t.metadata->>'source', '') = 'whatsapp_evolution'
        AND COALESCE(t.metadata->>'wa_lead_status_override', 'false') <> 'true'
        AND (
            COALESCE(t.metadata->>'wa_lead_status', '') = 'Erróneo'
            OR COALESCE(t.metadata->>'wa_delivery_error', '') <> ''
            OR EXISTS (
                SELECT 1
                FROM public.whatsapp_outbox o
                WHERE o.ticket_id = t.id
                  AND o.status = 'error'
                  AND o.error ILIKE '%exists":false%'
            )
        )
        AND NOT EXISTS (
            SELECT 1
            FROM public.whatsapp_outbox o2
            WHERE o2.ticket_id = t.id
              AND o2.status = 'sent'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM public.whatsapp_messages m
            WHERE m.ticket_id = t.id
              AND m.from_me = false
        )
  );

-- (B) Sync leads whose WhatsApp chat was marked Perdido but public.leads.status stayed stale.
UPDATE public.leads l
SET
    status = 'Perdido',
    updated_at = NOW()
WHERE l.status NOT IN ('Perdido', 'Cliente', 'Cerrado')
  AND EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.lead_id = l.id
        AND COALESCE(t.metadata->>'source', '') = 'whatsapp_evolution'
        AND t.metadata->>'wa_lead_status' = 'Perdido'
  );

-- (C) Re-align all WhatsApp ticket metadata with current public.leads.status (SSOT).
UPDATE public.tickets t
SET
    metadata = CASE
        WHEN l.status = 'Erróneo' THEN
            COALESCE(t.metadata, '{}'::jsonb) || jsonb_build_object(
                'wa_lead_status', 'Erróneo',
                'wa_delivery_error', COALESCE(NULLIF(t.metadata->>'wa_delivery_error', ''), 'Sin cuenta de WhatsApp'),
                'ai_qualifier_active', false
            )
        WHEN l.status IN ('Perdido', 'Cliente', 'Cerrado') THEN
            (COALESCE(t.metadata, '{}'::jsonb) - 'wa_delivery_error') || jsonb_build_object(
                'wa_lead_status', l.status,
                'ai_qualifier_active', false
            )
        ELSE
            (COALESCE(t.metadata, '{}'::jsonb) - 'wa_delivery_error') || jsonb_build_object(
                'wa_lead_status', l.status
            )
    END,
    updated_at = NOW()
FROM public.leads l
WHERE t.lead_id = l.id
  AND COALESCE(t.metadata->>'source', '') = 'whatsapp_evolution'
  AND (
      COALESCE(t.metadata->>'wa_lead_status', '') IS DISTINCT FROM l.status
      OR (l.status <> 'Erróneo' AND COALESCE(t.metadata->>'wa_delivery_error', '') <> '')
      OR (l.status IN ('Perdido', 'Erróneo', 'Cliente', 'Cerrado') AND COALESCE(t.metadata->>'ai_qualifier_active', 'false') = 'true')
  );
