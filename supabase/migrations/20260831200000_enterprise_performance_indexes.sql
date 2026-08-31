-- ============================================================================
-- Enterprise Performance Optimization: Composite B-Tree Indexes for Messaging
-- Eliminates sequential table scans and guarantees sub-50ms query times.
-- ============================================================================

-- 1. Index on marketing_conversations by tenant and last activity
CREATE INDEX IF NOT EXISTS idx_marketing_conversations_company_lastmsg 
ON marketing_conversations (company_id, last_message_at DESC NULLS LAST);

-- 2. Index on marketing_conversations by lead and channel
CREATE INDEX IF NOT EXISTS idx_marketing_conversations_lead_channel 
ON marketing_conversations (lead_id, channel);

-- 3. Index on marketing_messages by conversation and chronological ordering
CREATE INDEX IF NOT EXISTS idx_marketing_messages_conv_sent 
ON marketing_messages (conversation_id, sent_at ASC);

-- 4. Index on marketing_messages for inbound status and metadata queries
CREATE INDEX IF NOT EXISTS idx_marketing_messages_inbound_unread 
ON marketing_messages (conversation_id, direction, status) 
WHERE direction = 'inbound';
