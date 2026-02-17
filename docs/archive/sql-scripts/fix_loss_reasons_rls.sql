-- =====================================================
-- FIX: Loss Reasons RLS Policies for INSERT
-- =====================================================
-- The original "FOR ALL" policy doesn't work correctly for INSERT
-- because it references loss_reasons.company_id before the row exists.
-- We need separate policies for different operations.

-- Drop the problematic "FOR ALL" policy
DROP POLICY IF EXISTS "Admins can manage loss reasons" ON loss_reasons;

-- Policy 1: INSERT - Admins can create loss reasons for their company
CREATE POLICY "Admins can insert loss reasons"
ON loss_reasons FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND company_id = loss_reasons.company_id
        AND role IN ('company_admin', 'super_admin')
    )
);

-- Policy 2: UPDATE - Admins can update their company's loss reasons
CREATE POLICY "Admins can update loss reasons"
ON loss_reasons FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND company_id = loss_reasons.company_id
        AND role IN ('company_admin', 'super_admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND company_id = loss_reasons.company_id
        AND role IN ('company_admin', 'super_admin')
    )
);

-- Policy 3: DELETE - Admins can delete their company's loss reasons
CREATE POLICY "Admins can delete loss reasons"
ON loss_reasons FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND company_id = loss_reasons.company_id
        AND role IN ('company_admin', 'super_admin')
    )
);

-- The SELECT policy remains unchanged (already exists)
-- "Users can view their company loss reasons and templates"
