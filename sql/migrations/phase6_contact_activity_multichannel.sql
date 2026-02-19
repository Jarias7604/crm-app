-- ================================================================
-- PHASE 6: MULTI-CHANNEL CONTACT ACTIVITY SYSTEM
-- Evolves call_activities into a unified contact tracking system
-- Adds: action_type, dynamic goal periods, updated RPC
-- ================================================================

-- 1. Add action_type column to call_activities
-- Default 'call' preserves backward compatibility with existing data
ALTER TABLE call_activities 
ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'call';

-- Add check constraint for valid action types
ALTER TABLE call_activities 
ADD CONSTRAINT valid_action_type 
CHECK (action_type IN ('call', 'email', 'whatsapp', 'telegram', 'quote_sent', 'info_sent', 'meeting'));

-- Index for filtering by action_type
CREATE INDEX IF NOT EXISTS idx_call_activities_action_type 
ON call_activities(company_id, action_type, call_date DESC);

-- 2. Add goal_period to call_goals for dynamic period support
ALTER TABLE call_goals 
ADD COLUMN IF NOT EXISTS goal_period TEXT NOT NULL DEFAULT 'daily';

-- Add check constraint for valid periods
ALTER TABLE call_goals 
ADD CONSTRAINT valid_goal_period 
CHECK (goal_period IN ('daily', 'weekly', 'monthly'));

-- Rename daily_call_goal to goal_target for clarity (keep old column for compatibility)
ALTER TABLE call_goals 
ADD COLUMN IF NOT EXISTS goal_target INT;

-- Migrate existing data
UPDATE call_goals SET goal_target = daily_call_goal WHERE goal_target IS NULL;

-- 3. Add action_type to goals (allow per-action-type goals or combined)
ALTER TABLE call_goals 
ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT NULL;

-- NULL action_type = combined goal (all actions count)
-- Specific action_type = goal for that channel only

-- 4. Updated RPC function: get_contact_activity_summary
-- Returns per-user, per-action-type summary
CREATE OR REPLACE FUNCTION get_contact_activity_summary(
    p_company_id UUID,
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    action_type TEXT,
    total_actions INT,
    actions_connected INT,
    actions_no_answer INT,
    unique_leads INT,
    leads_with_status_change INT,
    avg_duration_seconds NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        ca.user_id,
        ca.action_type,
        COUNT(*)::INT AS total_actions,
        COUNT(*) FILTER (WHERE ca.outcome = 'connected')::INT AS actions_connected,
        COUNT(*) FILTER (WHERE ca.outcome = 'no_answer')::INT AS actions_no_answer,
        COUNT(DISTINCT ca.lead_id)::INT AS unique_leads,
        COUNT(*) FILTER (WHERE ca.status_before IS DISTINCT FROM ca.status_after AND ca.status_after IS NOT NULL)::INT AS leads_with_status_change,
        COALESCE(AVG(ca.duration_seconds) FILTER (WHERE ca.duration_seconds > 0), 0) AS avg_duration_seconds
    FROM call_activities ca
    WHERE ca.company_id = p_company_id
      AND (p_date_from IS NULL OR ca.call_date >= p_date_from)
      AND (p_date_to IS NULL OR ca.call_date <= p_date_to)
    GROUP BY ca.user_id, ca.action_type
    ORDER BY ca.user_id, total_actions DESC;
$$;

-- 5. Update the original summary function for backward compatibility
CREATE OR REPLACE FUNCTION get_call_activity_summary(
    p_company_id UUID,
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    calls_total INT,
    calls_connected INT,
    calls_no_answer INT,
    calls_voicemail INT,
    calls_busy INT,
    calls_wrong_number INT,
    unique_leads_called INT,
    leads_with_status_change INT,
    connect_rate NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        ca.user_id,
        COUNT(*)::INT AS calls_total,
        COUNT(*) FILTER (WHERE ca.outcome = 'connected')::INT AS calls_connected,
        COUNT(*) FILTER (WHERE ca.outcome = 'no_answer')::INT AS calls_no_answer,
        COUNT(*) FILTER (WHERE ca.outcome = 'voicemail')::INT AS calls_voicemail,
        COUNT(*) FILTER (WHERE ca.outcome = 'busy')::INT AS calls_busy,
        COUNT(*) FILTER (WHERE ca.outcome = 'wrong_number')::INT AS calls_wrong_number,
        COUNT(DISTINCT ca.lead_id)::INT AS unique_leads_called,
        COUNT(*) FILTER (WHERE ca.status_before IS DISTINCT FROM ca.status_after AND ca.status_after IS NOT NULL)::INT AS leads_with_status_change,
        CASE WHEN COUNT(*) > 0 
            THEN ROUND(COUNT(*) FILTER (WHERE ca.outcome = 'connected')::NUMERIC / COUNT(*)::NUMERIC * 100, 1)
            ELSE 0 
        END AS connect_rate
    FROM call_activities ca
    WHERE ca.company_id = p_company_id
      AND (p_date_from IS NULL OR ca.call_date >= p_date_from)
      AND (p_date_to IS NULL OR ca.call_date <= p_date_to)
    GROUP BY ca.user_id
    ORDER BY calls_total DESC;
$$;

-- Done! Run this in CRM-DEV SQL Editor
