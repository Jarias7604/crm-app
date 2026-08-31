-- ============================================================
-- Update process_incoming_marketing_message
-- Auto-fills 'source' from metadata.source_slug (e.g. 'facebook_ads')
-- Auto-fills 'interested_product_id' when metadata.ad_product is set
-- 2026-08-31
-- ============================================================

CREATE OR REPLACE FUNCTION process_incoming_marketing_message(
    p_company_id  UUID,
    p_channel     TEXT,
    p_external_id TEXT,
    p_sender_name TEXT,
    p_content     TEXT,
    p_metadata    JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_conversation_id    UUID;
    v_lead_id            UUID;
    v_source             TEXT;
    v_product_id         UUID;
BEGIN
    -- ── Resolve source ────────────────────────────────────────────
    -- Priority: metadata.source_slug > p_channel
    -- Examples: 'facebook_ads', 'whatsapp'
    v_source := COALESCE(
        NULLIF(p_metadata->>'source_slug', ''),
        p_channel
    );

    -- ── Resolve product from ad headline hint ─────────────────────
    -- metadata.ad_product is set by the webhook when headline contains ERP/CRM/SIPLE
    IF p_metadata->>'ad_product' IS NOT NULL THEN
        SELECT id INTO v_product_id
        FROM lead_products
        WHERE company_id = p_company_id
          AND UPPER(name) = UPPER(p_metadata->>'ad_product')
          AND is_active = TRUE
        LIMIT 1;
    END IF;

    -- 1. Look for existing conversation
    SELECT id, lead_id INTO v_conversation_id, v_lead_id
    FROM marketing_conversations
    WHERE company_id  = p_company_id
      AND channel     = p_channel
      AND external_id = p_external_id;

    -- 2. If no lead associated, find or create one
    IF v_lead_id IS NULL THEN
        -- Try to find existing lead by phone
        IF p_metadata->>'phone' IS NOT NULL THEN
            SELECT id INTO v_lead_id
            FROM leads
            WHERE company_id = p_company_id
              AND phone = p_metadata->>'phone'
            LIMIT 1;
        END IF;

        -- Still null → create new Prospecto lead with auto-detected source & product
        IF v_lead_id IS NULL THEN
            INSERT INTO leads (
                company_id,
                name,
                status,
                priority,
                source,
                phone,
                interested_product_id
            )
            VALUES (
                p_company_id,
                p_sender_name,
                'Prospecto',
                'medium',
                v_source,                               -- ← 'facebook_ads' | 'whatsapp'
                p_metadata->>'phone',
                v_product_id                            -- ← ERP/CRM/SIPLE uuid or NULL
            )
            RETURNING id INTO v_lead_id;
        ELSE
            -- Lead exists — update source if it's unset or generic 'whatsapp' and we know better
            UPDATE leads
            SET
                source = CASE
                    WHEN (source IS NULL OR source = 'whatsapp' OR source = '')
                         AND v_source <> 'whatsapp'
                    THEN v_source
                    ELSE source
                END,
                interested_product_id = CASE
                    WHEN interested_product_id IS NULL AND v_product_id IS NOT NULL
                    THEN v_product_id
                    ELSE interested_product_id
                END
            WHERE id = v_lead_id;
        END IF;
    END IF;

    -- 3. Create conversation if it doesn't exist yet
    IF v_conversation_id IS NULL THEN
        INSERT INTO marketing_conversations (
            company_id, lead_id, channel, external_id,
            last_message, last_message_at, metadata
        )
        VALUES (
            p_company_id, v_lead_id, p_channel, p_external_id,
            p_content, NOW(), p_metadata
        )
        RETURNING id INTO v_conversation_id;
    ELSE
        -- Update existing conversation with latest message
        UPDATE marketing_conversations
        SET
            last_message    = p_content,
            last_message_at = NOW(),
            unread_count    = unread_count + 1,
            metadata        = p_metadata
        WHERE id = v_conversation_id;
    END IF;

    -- 4. Insert the message
    INSERT INTO marketing_messages (
        conversation_id, content, direction, metadata
    )
    VALUES (
        v_conversation_id, p_content, 'inbound', p_metadata
    );

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
