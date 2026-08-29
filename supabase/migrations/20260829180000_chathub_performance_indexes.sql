-- ============================================================
-- PERFORMANCE: Add indexes for ChatHub conversation queries
-- 
-- ROOT CAUSE: marketing_conversations full-table scan on first
-- ChatHub load causes 3-5 second delay.
-- ============================================================

-- Primary ChatHub query index: company filter + time-ordered sort
CREATE INDEX IF NOT EXISTS idx_marketing_conversations_company_ts
    ON marketing_conversations (company_id, last_message_at DESC NULLS LAST);

-- Messages query index: opening a conversation
CREATE INDEX IF NOT EXISTS idx_marketing_messages_conv_time
    ON marketing_messages (conversation_id, sent_at ASC);

-- Lead join optimization
CREATE INDEX IF NOT EXISTS idx_marketing_conversations_lead_id
    ON marketing_conversations (lead_id)
    WHERE lead_id IS NOT NULL;

-- Unread count queries optimization  
CREATE INDEX IF NOT EXISTS idx_marketing_conversations_unread
    ON marketing_conversations (company_id, unread_count)
    WHERE unread_count > 0;
