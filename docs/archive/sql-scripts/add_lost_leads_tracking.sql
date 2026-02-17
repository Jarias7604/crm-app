-- =====================================================
-- MIGRATION: Add Lost Leads Tracking System
-- =====================================================
-- This migration adds support for tracking lost leads with:
-- 1. Configurable loss reasons per company
-- 2. Lost stage tracking
-- 3. Optional loss notes

-- Create loss_reasons table (configurable per company)
CREATE TABLE IF NOT EXISTS loss_reasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_loss_reasons_company ON loss_reasons(company_id);
CREATE INDEX IF NOT EXISTS idx_loss_reasons_active ON loss_reasons(is_active) WHERE is_active = true;

-- Add columns to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS lost_reason_id UUID REFERENCES loss_reasons(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS lost_at_stage TEXT,
ADD COLUMN IF NOT EXISTS lost_notes TEXT,
ADD COLUMN IF NOT EXISTS lost_date TIMESTAMPTZ;

-- Add index for lost leads queries
CREATE INDEX IF NOT EXISTS idx_leads_lost_reason ON leads(lost_reason_id) WHERE lost_reason_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_lost_stage ON leads(lost_at_stage) WHERE lost_at_stage IS NOT NULL;

-- Insert default loss reasons (company_id = NULL means "template" for new companies)
INSERT INTO loss_reasons (company_id, reason, display_order, is_active) VALUES
(NULL, 'Por Precio', 1, true),
(NULL, 'Por Servicio', 2, true),
(NULL, 'Tomó Sistema con MH', 3, true),
(NULL, 'Otros', 4, true),
(NULL, 'No Sabe/No Contesta', 5, true)
ON CONFLICT DO NOTHING;

-- Enable RLS on loss_reasons
ALTER TABLE loss_reasons ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their company's loss reasons + templates
CREATE POLICY "Users can view their company loss reasons and templates"
ON loss_reasons FOR SELECT
USING (
    company_id IS NULL OR 
    company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
    )
);

-- RLS Policy: Only admins can manage loss reasons
CREATE POLICY "Admins can manage loss reasons"
ON loss_reasons FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND company_id = loss_reasons.company_id
        AND role IN ('company_admin', 'super_admin')
    )
);

-- Function to auto-copy template loss reasons when a new company is created
CREATE OR REPLACE FUNCTION copy_template_loss_reasons()
RETURNS TRIGGER AS $$
BEGIN
    -- Copy all template loss reasons (company_id = NULL) to the new company
    INSERT INTO loss_reasons (company_id, reason, display_order, is_active)
    SELECT NEW.id, reason, display_order, is_active
    FROM loss_reasons
    WHERE company_id IS NULL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-copy loss reasons on company creation
DROP TRIGGER IF EXISTS trigger_copy_loss_reasons ON companies;
CREATE TRIGGER trigger_copy_loss_reasons
AFTER INSERT ON companies
FOR EACH ROW
EXECUTE FUNCTION copy_template_loss_reasons();

-- Update timestamp trigger for loss_reasons
CREATE OR REPLACE FUNCTION update_loss_reasons_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_loss_reasons_timestamp ON loss_reasons;
CREATE TRIGGER trigger_update_loss_reasons_timestamp
BEFORE UPDATE ON loss_reasons
FOR EACH ROW
EXECUTE FUNCTION update_loss_reasons_timestamp();

COMMENT ON TABLE loss_reasons IS 'Configurable catalog of loss reasons per company';
COMMENT ON COLUMN loss_reasons.company_id IS 'NULL = template for new companies, otherwise company-specific';
COMMENT ON COLUMN leads.lost_reason_id IS 'FK to loss_reasons - why the lead was lost';
COMMENT ON COLUMN leads.lost_at_stage IS 'The status the lead was in when marked as lost';
COMMENT ON COLUMN leads.lost_notes IS 'Optional additional context about why the lead was lost';
COMMENT ON COLUMN leads.lost_date IS 'Timestamp when the lead was marked as lost';
