-- ============================================================
-- Report Schedules — programar envíos automáticos de reportes
-- ============================================================
CREATE TABLE IF NOT EXISTS report_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES profiles(id),
    
    -- Target advisor
    advisor_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    advisor_name    TEXT NOT NULL,
    
    -- Recipients (one or more emails, comma-separated)
    recipient_emails TEXT NOT NULL,  -- e.g. "jimmy@arias.com,diana@arias.com"
    
    -- Schedule config
    frequency       TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'manual')),
    day_of_week     INT,   -- 0=Sunday, 1=Monday … (for weekly)
    day_of_month    INT,   -- 1-28 (for monthly)
    send_hour       INT DEFAULT 8,  -- hour UTC to send (0-23)
    
    -- Period for the report
    period          TEXT NOT NULL DEFAULT 'month',  -- today, week, month, quarter, year
    
    -- State
    is_active       BOOLEAN DEFAULT TRUE,
    last_sent_at    TIMESTAMPTZ,
    next_send_at    TIMESTAMPTZ,
    
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_schedules_company ON report_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_advisor ON report_schedules(advisor_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_send ON report_schedules(next_send_at) WHERE is_active = TRUE;

-- RLS
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;

-- Admins of the same company can manage schedules
CREATE POLICY "company_admin_manage_report_schedules"
ON report_schedules
FOR ALL
USING (
    company_id IN (
        SELECT company_id FROM profiles
        WHERE id = auth.uid()
        AND role = ANY (ARRAY['company_admin'::app_role, 'super_admin'::app_role])
    )
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_report_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_report_schedules_updated_at
BEFORE UPDATE ON report_schedules
FOR EACH ROW EXECUTE FUNCTION update_report_schedules_updated_at();
