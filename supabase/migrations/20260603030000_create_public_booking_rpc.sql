-- ================================================================
-- RPC: Safe public booking appointment creation & slot retrieval
-- Bypasses RLS to allow anonymous booking and slot checks without exposing client data
-- Migration: 20260603030000
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_public_booking(
    p_booking_link_id UUID,
    p_company_id UUID,
    p_user_id UUID,
    p_guest_name TEXT,
    p_guest_email TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_duration_minutes INT,
    p_timezone TEXT,
    p_guest_phone TEXT DEFAULT NULL,
    p_guest_company TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lead_id UUID;
    v_appointment_id UUID;
    v_follow_up_id UUID;
    v_result JSONB;
    v_clean_email TEXT;
    v_clean_phone TEXT;
    v_google_integration_id UUID;
    v_google_email TEXT;
BEGIN
    -- Sanitización de email
    v_clean_email := LOWER(TRIM(p_guest_email));
    
    -- Sanitización de teléfono
    v_clean_phone := NULLIF(TRIM(p_guest_phone), '');

    -- 1. Buscar si el lead ya existe por email en la misma compañía
    SELECT id INTO v_lead_id
    FROM public.leads
    WHERE company_id = p_company_id AND LOWER(TRIM(email)) = v_clean_email
    LIMIT 1;

    IF v_lead_id IS NULL THEN
        -- Crear nuevo Lead
        INSERT INTO public.leads (
            company_id,
            name,
            email,
            phone,
            company_name,
            assigned_to,
            source,
            status
        ) VALUES (
            p_company_id,
            p_guest_name,
            v_clean_email,
            v_clean_phone,
            NULLIF(TRIM(p_guest_company), ''),
            p_user_id,
            'Agendador Web',
            'Prospecto'
        )
        RETURNING id INTO v_lead_id;
    END IF;

    -- 2. Insertar la cita
    INSERT INTO public.booking_appointments (
        booking_link_id,
        company_id,
        user_id,
        guest_name,
        guest_email,
        guest_phone,
        guest_company,
        notes,
        start_time,
        end_time,
        duration_minutes,
        timezone,
        lead_id,
        status
    ) VALUES (
        p_booking_link_id,
        p_company_id,
        p_user_id,
        p_guest_name,
        v_clean_email,
        v_clean_phone,
        NULLIF(TRIM(p_guest_company), ''),
        p_notes,
        p_start_time,
        p_end_time,
        p_duration_minutes,
        p_timezone,
        v_lead_id,
        'confirmed'
    )
    RETURNING id INTO v_appointment_id;

    -- 3. Crear el FollowUp asociado en la tabla follow_ups
    INSERT INTO public.follow_ups (
        lead_id,
        company_id,
        user_id,
        assigned_to,
        date,
        notes,
        action_type,
        completed
    ) VALUES (
        v_lead_id,
        p_company_id,
        p_user_id,
        p_user_id,
        p_start_time,
        COALESCE(p_notes, 'Reunión agendada vía web por ' || p_guest_name),
        'meeting',
        FALSE
    )
    RETURNING id INTO v_follow_up_id;

    -- 4. Obtener integración de Google Calendar si existe y está activa
    SELECT id, provider_email INTO v_google_integration_id, v_google_email
    FROM public.calendar_integrations
    WHERE user_id = p_user_id AND provider = 'google' AND is_active = true
    LIMIT 1;

    -- 5. Construir el resultado JSON
    SELECT jsonb_build_object(
        'id', appt.id,
        'booking_link_id', appt.booking_link_id,
        'company_id', appt.company_id,
        'user_id', appt.user_id,
        'guest_name', appt.guest_name,
        'guest_email', appt.guest_email,
        'guest_phone', appt.guest_phone,
        'guest_company', appt.guest_company,
        'notes', appt.notes,
        'start_time', appt.start_time,
        'end_time', appt.end_time,
        'duration_minutes', appt.duration_minutes,
        'timezone', appt.timezone,
        'status', appt.status,
        'lead_id', appt.lead_id,
        'follow_up_id', v_follow_up_id,
        'google_integration_id', v_google_integration_id,
        'google_email', v_google_email
    ) INTO v_result
    FROM public.booking_appointments appt
    WHERE appt.id = v_appointment_id;

    RETURN v_result;
END;
$$;

-- RPC: Safe public message queue insertion
CREATE OR REPLACE FUNCTION public.enqueue_public_message(
    p_company_id UUID,
    p_lead_id UUID,
    p_channel TEXT,
    p_subject TEXT,
    p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
BEGIN
    INSERT INTO public.marketing_message_queue (
        company_id,
        lead_id,
        channel,
        subject,
        content,
        status,
        scheduled_at
    ) VALUES (
        p_company_id,
        p_lead_id,
        p_channel,
        p_subject,
        p_content,
        'pending',
        NOW()
    )
    RETURNING id INTO v_message_id;

    RETURN v_message_id;
END;
$$;

-- RPC: Safe public booked slot retrieval (protects client PII/private details)
CREATE OR REPLACE FUNCTION public.get_public_booked_slots(
    p_booking_link_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT start_time, end_time
    FROM public.booking_appointments
    WHERE booking_link_id = p_booking_link_id
      AND status = 'confirmed'
      AND start_time >= p_start_date
      AND start_time <= p_end_date;
$$;

-- Otorgar permisos de ejecución al rol público y autenticado
GRANT EXECUTE ON FUNCTION public.create_public_booking(
    UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_public_message(
    UUID, UUID, TEXT, TEXT, TEXT
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_booked_slots(
    UUID, TIMESTAMPTZ, TIMESTAMPTZ
) TO anon, authenticated;
