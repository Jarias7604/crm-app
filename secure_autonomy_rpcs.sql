-- Actualizar la función set_autonomy_level con seguridad correcta
-- La seguridad va en la función (SECURITY DEFINER), no en el frontend
-- Permite: super_admin a cualquier empresa, company_admin solo a su empresa

CREATE OR REPLACE FUNCTION set_autonomy_level(p_company_id UUID, p_level TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_company_id UUID;
BEGIN
    SELECT role, company_id INTO v_role, v_company_id
    FROM profiles WHERE id = auth.uid();

    IF NOT (v_role = 'super_admin' OR (v_role = 'company_admin' AND v_company_id = p_company_id)) THEN
        RAISE EXCEPTION 'No tienes permiso para cambiar esta configuración';
    END IF;

    INSERT INTO ai_autonomy_settings (company_id, autonomy_level)
    VALUES (p_company_id, p_level)
    ON CONFLICT (company_id)
    DO UPDATE SET autonomy_level = p_level, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION get_autonomy_level(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_level TEXT;
BEGIN
    SELECT autonomy_level INTO v_level
    FROM ai_autonomy_settings
    WHERE company_id = p_company_id;
    RETURN COALESCE(v_level, 'copilot');
END;
$$;

GRANT EXECUTE ON FUNCTION get_autonomy_level(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_autonomy_level(UUID, TEXT) TO authenticated;
