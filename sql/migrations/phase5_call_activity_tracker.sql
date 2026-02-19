-- =====================================================
-- PHASE 5 - FEATURE 5.1: Call Activity Tracker & KPIs
-- Applied: 2026-02-19
-- Status: PENDING
-- =====================================================
-- Adds call activity tracking for sales teams:
-- 1. call_activities table — logs every call made by a user to a lead
-- 2. call_goals table — daily call goals per user or team
-- 3. RPC function — aggregated stats for dashboards
-- 4. RLS policies — multi-tenant isolation

-- =======================================
-- TABLE 1: call_activities
-- =======================================
CREATE TABLE IF NOT EXISTS public.call_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    call_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_seconds INTEGER DEFAULT NULL,
    outcome TEXT NOT NULL DEFAULT 'connected' 
        CHECK (outcome IN ('connected', 'no_answer', 'voicemail', 'busy', 'wrong_number', 'scheduled')),
    notes TEXT DEFAULT NULL,
    status_before TEXT DEFAULT NULL,
    status_after TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_activities_company 
    ON call_activities(company_id);
CREATE INDEX IF NOT EXISTS idx_call_activities_user_date 
    ON call_activities(company_id, user_id, call_date);
CREATE INDEX IF NOT EXISTS idx_call_activities_lead 
    ON call_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_activities_date 
    ON call_activities(call_date);

-- Comments
COMMENT ON TABLE call_activities IS 'Logs every call activity made by sales team members to leads';
COMMENT ON COLUMN call_activities.outcome IS 'Result of the call: connected, no_answer, voicemail, busy, wrong_number, scheduled';
COMMENT ON COLUMN call_activities.status_before IS 'Lead status before the call was made';
COMMENT ON COLUMN call_activities.status_after IS 'Lead status after the call (if changed by user)';
COMMENT ON COLUMN call_activities.duration_seconds IS 'Optional call duration in seconds (for future integrations)';

-- =======================================
-- TABLE 2: call_goals
-- =======================================
CREATE TABLE IF NOT EXISTS public.call_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    daily_call_goal INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Either user_id or team_id must be set, not both
    CONSTRAINT call_goals_target_check CHECK (
        (user_id IS NOT NULL AND team_id IS NULL) OR 
        (user_id IS NULL AND team_id IS NOT NULL)
    ),
    -- One goal per user per company, one goal per team per company
    CONSTRAINT call_goals_user_unique UNIQUE (company_id, user_id),
    CONSTRAINT call_goals_team_unique UNIQUE (company_id, team_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_call_goals_company 
    ON call_goals(company_id);

-- Comments
COMMENT ON TABLE call_goals IS 'Daily call goals per user or team';
COMMENT ON COLUMN call_goals.daily_call_goal IS 'Number of calls expected per day from this user/team';

-- =======================================
-- RLS: call_activities
-- =======================================
ALTER TABLE call_activities ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can see call activities for their company
CREATE POLICY "Users can view company call activities"
ON call_activities FOR SELECT
USING (
    company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
    )
);

-- INSERT: Users can log calls for their company
CREATE POLICY "Users can log call activities"
ON call_activities FOR INSERT
WITH CHECK (
    company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
);

-- UPDATE: Users can update their own call activities
CREATE POLICY "Users can update own call activities"
ON call_activities FOR UPDATE
USING (
    user_id = auth.uid()
);

-- DELETE: Only admins can delete call activities
CREATE POLICY "Admins can delete call activities"
ON call_activities FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND company_id = call_activities.company_id
        AND role IN ('company_admin', 'super_admin')
    )
);

-- Super admin full access
CREATE POLICY "Super admin full access to call activities"
ON call_activities FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'super_admin'
    )
);

-- =======================================
-- RLS: call_goals
-- =======================================
ALTER TABLE call_goals ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view their company's goals
CREATE POLICY "Users can view company call goals"
ON call_goals FOR SELECT
USING (
    company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
    )
);

-- ALL: Admins can manage call goals
CREATE POLICY "Admins can manage call goals"
ON call_goals FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND company_id = call_goals.company_id
        AND role IN ('company_admin', 'super_admin')
    )
);

-- =======================================
-- UPDATE TIMESTAMP TRIGGER for call_goals
-- =======================================
CREATE OR REPLACE FUNCTION update_call_goals_timestamp()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_call_goals_timestamp ON call_goals;
CREATE TRIGGER trigger_update_call_goals_timestamp
BEFORE UPDATE ON call_goals
FOR EACH ROW
EXECUTE FUNCTION update_call_goals_timestamp();

-- =======================================
-- RPC: get_call_activity_summary
-- =======================================
-- Returns aggregated call stats per user for a date range
CREATE OR REPLACE FUNCTION get_call_activity_summary(
    p_company_id UUID,
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    calls_total BIGINT,
    calls_connected BIGINT,
    calls_no_answer BIGINT,
    calls_voicemail BIGINT,
    calls_busy BIGINT,
    calls_wrong_number BIGINT,
    unique_leads_called BIGINT,
    leads_with_status_change BIGINT,
    connect_rate NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ca.user_id,
        COUNT(*)::BIGINT as calls_total,
        COUNT(*) FILTER (WHERE ca.outcome = 'connected')::BIGINT as calls_connected,
        COUNT(*) FILTER (WHERE ca.outcome = 'no_answer')::BIGINT as calls_no_answer,
        COUNT(*) FILTER (WHERE ca.outcome = 'voicemail')::BIGINT as calls_voicemail,
        COUNT(*) FILTER (WHERE ca.outcome = 'busy')::BIGINT as calls_busy,
        COUNT(*) FILTER (WHERE ca.outcome = 'wrong_number')::BIGINT as calls_wrong_number,
        COUNT(DISTINCT ca.lead_id)::BIGINT as unique_leads_called,
        COUNT(*) FILTER (WHERE ca.status_before IS DISTINCT FROM ca.status_after AND ca.status_after IS NOT NULL)::BIGINT as leads_with_status_change,
        CASE 
            WHEN COUNT(*) > 0 
            THEN ROUND((COUNT(*) FILTER (WHERE ca.outcome = 'connected')::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
            ELSE 0
        END as connect_rate
    FROM call_activities ca
    WHERE ca.company_id = p_company_id
      AND (p_date_from IS NULL OR ca.call_date >= p_date_from)
      AND (p_date_to IS NULL OR ca.call_date <= p_date_to)
    GROUP BY ca.user_id;
END;
$$;

-- =======================================
-- ROLLBACK (if needed)
-- =======================================
-- DROP FUNCTION IF EXISTS get_call_activity_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
-- DROP FUNCTION IF EXISTS update_call_goals_timestamp();
-- DROP TRIGGER IF EXISTS trigger_update_call_goals_timestamp ON call_goals;
-- DROP TABLE IF EXISTS call_goals;
-- DROP TABLE IF EXISTS call_activities;
