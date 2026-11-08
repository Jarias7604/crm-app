-- =============================================================================
-- Public Lead Discovery Form (Método ARIAS 7 Preguntas) -> Auto-sync to WhatsApp Chat & Leads
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_public_lead_discovery(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
  v_lead record;
  v_company record;
  v_seller record;
  v_booking_slug text;
  v_owner_id uuid;
BEGIN
  -- 1. Try finding by ticket.id first
  SELECT t.* INTO v_ticket
  FROM public.tickets t
  WHERE t.id = p_id
  LIMIT 1;

  IF v_ticket.id IS NOT NULL AND v_ticket.lead_id IS NOT NULL THEN
    SELECT l.* INTO v_lead
    FROM public.leads l
    WHERE l.id = v_ticket.lead_id
    LIMIT 1;
  ELSIF v_ticket.id IS NULL THEN
    -- 2. Otherwise find by lead.id and locate latest WhatsApp ticket
    SELECT l.* INTO v_lead
    FROM public.leads l
    WHERE l.id = p_id
    LIMIT 1;

    IF v_lead.id IS NOT NULL THEN
      SELECT t.* INTO v_ticket
      FROM public.tickets t
      WHERE t.lead_id = v_lead.id
        AND t.metadata->>'source' = 'whatsapp_evolution'
      ORDER BY t.updated_at DESC NULLS LAST
      LIMIT 1;
    END IF;
  END IF;

  IF v_ticket.id IS NULL AND v_lead.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT c.id, c.name, c.logo_url INTO v_company
  FROM public.companies c
  WHERE c.id = coalesce(v_lead.company_id, v_ticket.company_id)
  LIMIT 1;

  v_owner_id := coalesce(v_lead.assigned_to, v_ticket.assigned_to);
  IF v_owner_id IS NOT NULL THEN
    SELECT p.id, p.full_name, p.email INTO v_seller
    FROM public.profiles p
    WHERE p.id = v_owner_id
    LIMIT 1;

    SELECT bl.slug INTO v_booking_slug
    FROM public.booking_links bl
    WHERE bl.user_id = v_owner_id
      AND bl.is_active = true
    ORDER BY bl.created_at ASC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ticket_id', v_ticket.id,
    'lead_id', v_lead.id,
    'company_id', coalesce(v_lead.company_id, v_ticket.company_id),
    'client_name', coalesce(v_lead.name, v_ticket.lead_name, v_ticket.metadata->>'whatsapp_push_name', 'Estimado cliente'),
    'client_company', coalesce(v_lead.company_name, ''),
    'phone', coalesce(v_lead.phone, v_ticket.metadata->>'whatsapp_phone', ''),
    'provider_name', coalesce(v_company.name, 'Arias CRM'),
    'provider_logo', v_company.logo_url,
    'seller_name', CASE
      WHEN v_seller.full_name IS NULL OR v_seller.full_name ~* '^platform\s*owner$' THEN 'Jimmy Arias'
      ELSE v_seller.full_name
    END,
    'booking_slug', v_booking_slug,
    'existing_discovery', coalesce(v_ticket.metadata->'wa_discovery', '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_lead_discovery(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_public_lead_discovery(
  p_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
  v_lead record;
  v_now timestamptz := now();
  v_client_name text;
  v_company_name text;
  v_q1 text;
  v_q2 text;
  v_q3 text;
  v_q4 text;
  v_q5 text;
  v_q6 text;
  v_q7 text;
  v_summary text;
  v_meta jsonb;
BEGIN
  SELECT t.* INTO v_ticket FROM public.tickets t WHERE t.id = p_id LIMIT 1;

  IF v_ticket.id IS NOT NULL AND v_ticket.lead_id IS NOT NULL THEN
    SELECT l.* INTO v_lead FROM public.leads l WHERE l.id = v_ticket.lead_id LIMIT 1;
  ELSIF v_ticket.id IS NULL THEN
    SELECT l.* INTO v_lead FROM public.leads l WHERE l.id = p_id LIMIT 1;
    IF v_lead.id IS NOT NULL THEN
      SELECT t.* INTO v_ticket
      FROM public.tickets t
      WHERE t.lead_id = v_lead.id
        AND t.metadata->>'source' = 'whatsapp_evolution'
      ORDER BY t.updated_at DESC NULLS LAST
      LIMIT 1;
    END IF;
  END IF;

  IF v_ticket.id IS NULL AND v_lead.id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el registro del prospecto';
  END IF;

  v_client_name := coalesce(nullif(trim(p_payload->>'client_name'), ''), v_lead.name, v_ticket.lead_name, 'Prospecto');
  v_company_name := coalesce(nullif(trim(p_payload->>'company_name'), ''), v_lead.company_name, 'Individual');
  v_q1 := coalesce(trim(p_payload->>'q1'), '');
  v_q2 := coalesce(trim(p_payload->>'q2'), '');
  v_q3 := coalesce(trim(p_payload->>'q3'), '');
  v_q4 := coalesce(trim(p_payload->>'q4'), '');
  v_q5 := coalesce(trim(p_payload->>'q5'), '');
  v_q6 := coalesce(trim(p_payload->>'q6'), '');
  v_q7 := coalesce(trim(p_payload->>'q7'), '');

  v_summary := format(
    E'=== DIAGNÓSTICO COMPLETADO POR EL PROSPECTO (MÉTODO ARIAS) ===\nProspecto: %s (%s)\n1. Diagnóstico / Proceso prioritario: %s\n2. Impacto / Situación actual: %s\n3. Sistema o método actual: %s\n4. Quién aprueba la compra: %s\n5. Plazo de implementación: %s\n6. Alcance / Usuarios: %s\n7. Siguiente paso preferido: %s',
    v_client_name,
    v_company_name,
    v_q1,
    v_q2,
    v_q3,
    v_q4,
    v_q5,
    v_q6,
    v_q7
  );

  -- Update Lead if present
  IF v_lead.id IS NOT NULL THEN
    UPDATE public.leads
    SET
      name = v_client_name,
      company_name = v_company_name,
      status = CASE WHEN status IN ('Cerrado', 'Cliente') THEN status ELSE 'Lead calificado' END,
      next_action_notes = v_summary,
      last_follow_up_at = v_now
    WHERE id = v_lead.id;

    INSERT INTO public.follow_ups (lead_id, action_type, notes, date)
    VALUES (v_lead.id, 'whatsapp', v_summary, CURRENT_DATE);
  END IF;

  -- Update WhatsApp Ticket & insert visible chat summary note
  IF v_ticket.id IS NOT NULL THEN
    v_meta := coalesce(v_ticket.metadata, '{}'::jsonb) || jsonb_build_object(
      'wa_discovery', p_payload || jsonb_build_object('completed_at', v_now),
      'wa_discovery_completed', true,
      'wa_discovery_completed_at', v_now,
      'wa_lead_status', 'Lead calificado',
      'last_message_from', 'client',
      'last_whatsapp_at', v_now,
      'last_whatsapp_message', 'Diagnóstico completado: ' || left(v_q1, 90),
      'last_message_preview', 'Diagnóstico completado: ' || left(v_q1, 90)
    );

    UPDATE public.tickets
    SET
      lead_name = v_client_name,
      updated_at = v_now,
      metadata = v_meta
    WHERE id = v_ticket.id;

    INSERT INTO public.ticket_comments (ticket_id, company_id, body, is_internal)
    VALUES (
      v_ticket.id,
      v_ticket.company_id,
      'Nota interna (Diagnóstico Express completado por ' || v_client_name || '): ' || E'\n' || v_summary,
      true
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'lead_id', v_lead.id, 'ticket_id', v_ticket.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_lead_discovery(uuid, jsonb) TO anon, authenticated;

