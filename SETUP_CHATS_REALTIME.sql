-- =====================================================
-- OMNICHANNEL CHAT SYSTEM
-- =====================================================

-- 1. CONVERSATIONS (Groups messages by channel/sender)
CREATE TABLE IF NOT EXISTS marketing_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    lead_id UUID REFERENCES leads(id), -- Null if lead not yet identified? No, we will create one.
    
    channel VARCHAR(50) NOT NULL, -- 'telegram', 'whatsapp', 'web'
    external_id TEXT NOT NULL, -- The identifier in the external system (e.g. Telegram Chat ID)
    
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'closed', 'snoozed'
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    unread_count INTEGER DEFAULT 0,
    
    metadata JSONB DEFAULT '{}'::jsonb, -- Store info like sender name, bio, etc.
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, channel, external_id)
);

-- 2. MESSAGES
CREATE TABLE IF NOT EXISTS marketing_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES marketing_conversations(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    
    type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'file', 'video'
    status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    
    external_message_id TEXT, -- ID from Telegram/WhatsApp
    
    metadata JSONB DEFAULT '{}'::jsonb,
    
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_messages_conv ON marketing_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead ON marketing_conversations(lead_id);

-- RLS
ALTER TABLE marketing_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_messages ENABLE ROW LEVEL SECURITY;

-- Simple Policy (Using Company Isolation)
CREATE POLICY "Conversations Access" ON marketing_conversations FOR ALL TO authenticated USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Messages Access" ON marketing_messages FOR ALL TO authenticated USING (
    conversation_id IN (SELECT id FROM marketing_conversations WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- 3. FUNCTION TO AUTO-CREATE LEAD ON INCOMING MESSAGE
CREATE OR REPLACE FUNCTION process_incoming_marketing_message(
    p_company_id UUID,
    p_channel TEXT,
    p_external_id TEXT,
    p_sender_name TEXT,
    p_content TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_lead_id UUID;
BEGIN
    -- 1. Look for conversation
    SELECT id, lead_id INTO v_conversation_id, v_lead_id 
    FROM marketing_conversations 
    WHERE company_id = p_company_id AND channel = p_channel AND external_id = p_external_id;
    
    -- 2. If no lead associated or no conversation, look for lead by name/metadata or create one
    IF v_lead_id IS NULL THEN
        -- Try to find lead by phone if present in metadata
        IF p_metadata->>'phone' IS NOT NULL THEN
            SELECT id INTO v_lead_id FROM leads WHERE company_id = p_company_id AND phone = p_metadata->>'phone' LIMIT 1;
        END IF;
        
        -- If still null, create new Prospect lead
        IF v_lead_id IS NULL THEN
            INSERT INTO leads (company_id, name, status, priority, source, phone)
            VALUES (p_company_id, p_sender_name, 'Prospecto', 'medium', p_channel, p_metadata->>'phone')
            RETURNING id INTO v_lead_id;
        END IF;
    END IF;
    
    -- 3. Create conversation if not exists
    IF v_conversation_id IS NULL THEN
        INSERT INTO marketing_conversations (company_id, lead_id, channel, external_id, last_message, last_message_at, metadata)
        VALUES (p_company_id, v_lead_id, p_channel, p_external_id, p_content, NOW(), p_metadata)
        RETURNING id INTO v_conversation_id;
    ELSE
        -- Update existing conversation
        UPDATE marketing_conversations 
        SET last_message = p_content, 
            last_message_at = NOW(), 
            unread_count = unread_count + 1,
            lead_id = v_lead_id -- Link lead if it was just found/created
        WHERE id = v_conversation_id;
    END IF;
    
    -- 4. Store message
    INSERT INTO marketing_messages (conversation_id, content, direction, status)
    VALUES (v_conversation_id, p_content, 'inbound', 'delivered');
    
    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;
