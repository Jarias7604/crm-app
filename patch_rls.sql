DROP POLICY IF EXISTS "Admins can update their company autonomy settings" ON ai_autonomy_settings; 
CREATE POLICY "Admins can update their company autonomy settings" ON ai_autonomy_settings FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'company_admin') OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
