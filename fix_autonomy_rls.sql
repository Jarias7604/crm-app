-- Super Admin debe poder gestionar ai_autonomy_settings de CUALQUIER empresa
-- Company Admin solo puede gestionar SU empresa
-- Esto es el modelo RBAC correcto para multi-tenant SaaS

DROP POLICY IF EXISTS "Admins can update their company autonomy settings" ON ai_autonomy_settings;
DROP POLICY IF EXISTS "Users can view their company autonomy settings" ON ai_autonomy_settings;

-- READ: company_admin ve su empresa, super_admin ve todas
CREATE POLICY "autonomy_settings_read"
    ON ai_autonomy_settings FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
        OR
        company_id = (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    );

-- WRITE: company_admin escribe su empresa, super_admin escribe cualquiera
CREATE POLICY "autonomy_settings_write"
    ON ai_autonomy_settings FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
        OR
        company_id = (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'company_admin' LIMIT 1)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
        OR
        company_id = (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'company_admin' LIMIT 1)
    );
