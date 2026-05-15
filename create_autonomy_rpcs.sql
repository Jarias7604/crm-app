-- Crear funciones RPC para ai_autonomy_settings
-- Las funciones no dependen del schema cache de PostgREST
-- Se ejecutan inmediatamente sin necesidad de reload

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

CREATE OR REPLACE FUNCTION set_autonomy_level(p_company_id UUID, p_level TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO ai_autonomy_settings (company_id, autonomy_level)
    VALUES (p_company_id, p_level)
    ON CONFLICT (company_id) 
    DO UPDATE SET autonomy_level = p_level, updated_at = now();
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_autonomy_level(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_autonomy_level(UUID, TEXT) TO authenticated;
