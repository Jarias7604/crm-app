-- =====================================================
-- MANUAL FIX: Insert default loss reasons for existing companies
-- =====================================================
-- This script manually inserts default loss reasons for companies
-- that were created before the trigger was set up

-- Insert default loss reasons for all companies that don't have any
INSERT INTO loss_reasons (company_id, reason, display_order, is_active)
SELECT 
    c.id as company_id,
    template.reason,
    template.display_order,
    template.is_active
FROM companies c
CROSS JOIN (
    SELECT reason, display_order, is_active
    FROM loss_reasons
    WHERE company_id IS NULL
) template
WHERE NOT EXISTS (
    SELECT 1 
    FROM loss_reasons lr 
    WHERE lr.company_id = c.id
)
ORDER BY c.id, template.display_order;

-- Verify the insert
SELECT 
    c.name as company_name,
    COUNT(lr.id) as loss_reasons_count
FROM companies c
LEFT JOIN loss_reasons lr ON lr.company_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;
