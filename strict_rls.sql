DROP POLICY IF EXISTS "Admins can update their company autonomy settings" ON ai_autonomy_settings;
CREATE POLICY "Admins can update their company autonomy settings"
    ON ai_autonomy_settings FOR ALL
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('company_admin', 'super_admin')
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('company_admin', 'super_admin')
        )
    );
