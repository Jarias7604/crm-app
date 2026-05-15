-- Migration: Create AI Tasks Queue and Autonomy Settings

-- 1. AI Autonomy Settings Table
CREATE TABLE IF NOT EXISTS ai_autonomy_settings (
    company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    autonomy_level TEXT NOT NULL DEFAULT 'copilot' CHECK (autonomy_level IN ('copilot', 'semi', 'autopilot')),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES profiles(id)
);

-- 2. AI Tasks Queue Table
CREATE TABLE IF NOT EXISTS ai_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL, -- e.g., 'oracle', 'maya', 'sofia', 'atlas'
    task_type TEXT NOT NULL, -- e.g., 'send_campaign', 'reactivate_lead'
    title TEXT NOT NULL,
    description TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'autopilot')),
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    impact_estimate TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    executed_at TIMESTAMPTZ,
    executed_by UUID REFERENCES profiles(id) -- Null if executed by AI (autopilot)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_tasks_company_id ON ai_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);

-- RLS Policies
ALTER TABLE ai_autonomy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;

-- Policies for ai_autonomy_settings
CREATE POLICY "Users can view their company autonomy settings"
    ON ai_autonomy_settings FOR SELECT
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update their company autonomy settings"
    ON ai_autonomy_settings FOR ALL
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'owner')
        )
    );

-- Policies for ai_tasks
CREATE POLICY "Users can view their company ai tasks"
    ON ai_tasks FOR SELECT
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their company ai tasks"
    ON ai_tasks FOR UPDATE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Insert trigger for updated_at
CREATE OR REPLACE FUNCTION update_ai_autonomy_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_autonomy_settings_updated_at ON ai_autonomy_settings;
CREATE TRIGGER trg_ai_autonomy_settings_updated_at
    BEFORE UPDATE ON ai_autonomy_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_autonomy_settings_updated_at();
