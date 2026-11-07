-- Platform owners (is_platform_owner = true) see every WhatsApp conversation,
-- whatever their custom role is (they use role simulation in the UI).
-- Only replaces wa_viewer_scopes() (created in 20261106180000); no frozen function touched.
CREATE OR REPLACE FUNCTION public.wa_viewer_scopes()
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role   text;
  v_custom uuid;
  v_active boolean;
  v_owner  boolean;
  v_perms  text[] := '{}';
  v_out    text[] := '{}';
BEGIN
  SELECT role::text, custom_role_id, coalesce(is_active, true), coalesce(is_platform_owner, false)
    INTO v_role, v_custom, v_active, v_owner
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS NULL OR NOT v_active THEN
    RETURN '{}';
  END IF;

  IF v_owner OR v_role IN ('super_admin', 'company_admin') THEN
    RETURN ARRAY['all'];
  END IF;

  IF v_custom IS NOT NULL THEN
    SELECT coalesce(array_agg(rp.permission_key), '{}')
      INTO v_perms
    FROM public.role_permissions rp
    WHERE rp.role_id = v_custom
      AND rp.is_enabled = true
      AND rp.permission_key IN ('wa_chat_all', 'wa_chat_soporte', 'wa_chat_leads');
  END IF;

  IF 'wa_chat_all' = ANY (v_perms) THEN
    RETURN ARRAY['all'];
  END IF;
  IF 'wa_chat_soporte' = ANY (v_perms) THEN
    v_out := v_out || 'soporte'::text;
  END IF;
  IF 'wa_chat_leads' = ANY (v_perms) THEN
    v_out := v_out || 'leads'::text;
  END IF;
  RETURN v_out;
END;
$$;
