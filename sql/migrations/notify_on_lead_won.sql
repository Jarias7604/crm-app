-- Function to send Telegram message via database trigger
CREATE OR REPLACE FUNCTION public.handle_lead_won_notification()
RETURNS TRIGGER AS $$
DECLARE
    assigned_user_chat_id TEXT;
    assigned_user_name TEXT;
    lead_name TEXT;
    company_name TEXT;
    message_body TEXT;
    marketing_conv_id UUID;
    company_id UUID;
BEGIN
    -- Only trigger if status changed to 'Cerrado' or 'Cliente'
    IF (NEW.status IN ('Cerrado', 'Cliente') AND (OLD.status IS NULL OR OLD.status NOT IN ('Cerrado', 'Cliente'))) THEN
        
        -- Get the assigned user's Telegram Chat ID and Name
        SELECT telegram_chat_id, full_name INTO assigned_user_chat_id, assigned_user_name
        FROM public.profiles
        WHERE id = NEW.assigned_to;

        -- If the user has a Telegram Chat ID, send the notification
        IF assigned_user_chat_id IS NOT NULL THEN
            lead_name := COALESCE(NEW.name, 'Lead sin nombre');
            company_name := COALESCE(NEW.company_name, 'Sin empresa');
            company_id := NEW.company_id;

            -- Find or create a system conversation for this lead to host the notification
            SELECT id INTO marketing_conv_id
            FROM public.marketing_conversations
            WHERE lead_id = NEW.id AND channel = 'telegram'
            LIMIT 1;

            IF marketing_conv_id IS NULL THEN
                INSERT INTO public.marketing_conversations (lead_id, company_id, channel, provider, status)
                VALUES (NEW.id, company_id, 'telegram', 'system', 'active')
                RETURNING id INTO marketing_conv_id;
            END IF;

            -- Construct the message
            message_body := '? ¡TRATO GANADO! ' || CHR(10) ||
                           'Líder: ' || lead_name || CHR(10) ||
                           'Empresa: ' || company_name || CHR(10) ||
                           'Estado: ' || NEW.status || CHR(10) ||
                           'Responsable: ' || COALESCE(assigned_user_name, 'Asignado');

            -- Insert into marketing_messages to trigger the send-telegram-message function
            INSERT INTO public.marketing_messages (
                conversation_id,
                company_id,
                direction,
                content,
                status,
                metadata
            ) VALUES (
                marketing_conv_id,
                company_id,
                'outbound',
                message_body,
                'pending',
                jsonb_build_object(
                    'telegram_chat_id', assigned_user_chat_id,
                    'notification_type', 'onboarding_trigger'
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_lead_won_notification ON public.leads;
CREATE TRIGGER on_lead_won_notification
    AFTER UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_lead_won_notification();
