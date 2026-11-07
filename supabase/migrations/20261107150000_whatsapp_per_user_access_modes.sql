-- =============================================================================
-- WhatsApp Support Chat (+503 7971-8911) — Per-User Access Modes & Strict Scope Isolation
--
-- Additive update to public.wa_viewer_scopes() and public.wa_ticket_visible()
-- so Admins can assign individual team members to:
--   * admin_all        -> Full visibility (Soporte + all Leads + Equipo + Spam)
--   * soporte_team     -> All Support chats & client groups (0% Sales/Leads)
--   * soporte_assigned -> Only Support chats assigned to auth.uid() (0% Sales/Leads)
--   * ventas_pool      -> Unclassified new leads pool + own assigned Leads (0% Support)
--   * ventas_assigned  -> Only own assigned Leads (no unclassified pool, 0% Support)
--   * none             -> No WhatsApp access
-- Falls back automatically to custom_roles -> role_permissions when not set on profile.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.wa_viewer_scopes()
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role        text;
  v_custom      uuid;
  v_active      boolean;
  v_owner       boolean;
  v_user_perms  jsonb;
  v_mode        text;
  v_perms       text[] := '{}';
  v_out         text[] := '{}';
BEGIN
  SELECT role::text, custom_role_id, coalesce(is_active, true), coalesce(is_platform_owner, false), coalesce(permissions, '{}'::jsonb)
    INTO v_role, v_custom, v_active, v_owner, v_user_perms
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS NULL OR NOT v_active THEN
    RETURN '{}';
  END IF;

  IF v_owner OR v_role IN ('super_admin', 'company_admin') THEN
    RETURN ARRAY['all'];
  END IF;

  v_mode := coalesce(v_user_perms->>'wa_access_mode', '');
  IF v_mode = 'admin_all' THEN
    RETURN ARRAY['all'];
  ELSIF v_mode = 'soporte_team' THEN
    RETURN ARRAY['soporte'];
  ELSIF v_mode = 'soporte_assigned' THEN
    RETURN ARRAY['soporte', 'soporte_assigned_only'];
  ELSIF v_mode = 'ventas_pool' THEN
    RETURN ARRAY['leads'];
  ELSIF v_mode = 'ventas_assigned' THEN
    RETURN ARRAY['leads', 'leads_assigned_only'];
  ELSIF v_mode = 'both' THEN
    RETURN ARRAY['soporte', 'leads'];
  ELSIF v_mode = 'none' THEN
    RETURN '{}';
  END IF;

  IF v_custom IS NOT NULL THEN
    SELECT coalesce(array_agg(rp.permission_key), '{}')
      INTO v_perms
    FROM public.role_permissions rp
    WHERE rp.role_id = v_custom
      AND rp.is_enabled = true
      AND rp.permission_key IN ('wa_chat_all', 'wa_chat_soporte', 'wa_chat_leads');
  END IF;

  IF 'wa_chat_all' = ANY (v_perms) OR coalesce((v_user_perms->>'wa_chat_all')::boolean, false) THEN
    RETURN ARRAY['all'];
  END IF;
  IF 'wa_chat_soporte' = ANY (v_perms) OR coalesce((v_user_perms->>'wa_chat_soporte')::boolean, false) THEN
    v_out := v_out || 'soporte'::text;
    IF coalesce((v_user_perms->>'wa_soporte_assigned_only')::boolean, false) THEN
      v_out := v_out || 'soporte_assigned_only'::text;
    END IF;
  END IF;
  IF 'wa_chat_leads' = ANY (v_perms) OR coalesce((v_user_perms->>'wa_chat_leads')::boolean, false) THEN
    v_out := v_out || 'leads'::text;
    IF coalesce((v_user_perms->>'wa_leads_assigned_only')::boolean, false) THEN
      v_out := v_out || 'leads_assigned_only'::text;
    END IF;
  END IF;
  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wa_viewer_scopes() TO authenticated;

CREATE OR REPLACE FUNCTION public.wa_ticket_visible(
  p_meta jsonb,
  p_lead_id uuid,
  p_assigned uuid,
  p_scopes text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN coalesce(p_meta->>'source', '') <> 'whatsapp_evolution' THEN true
    WHEN 'all' = ANY (coalesce(p_scopes, '{}')) THEN true
    WHEN p_meta->>'wa_scope' = 'soporte' THEN
      'soporte' = ANY (coalesce(p_scopes, '{}'))
      AND (
        NOT ('soporte_assigned_only' = ANY (coalesce(p_scopes, '{}')))
        OR p_assigned = auth.uid()
      )
    WHEN p_meta->>'wa_scope' = 'por_clasificar' THEN
      'leads' = ANY (coalesce(p_scopes, '{}'))
      AND NOT ('leads_assigned_only' = ANY (coalesce(p_scopes, '{}')))
    WHEN p_meta->>'wa_scope' = 'lead' THEN
      'leads' = ANY (coalesce(p_scopes, '{}'))
      AND (
        p_assigned = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.leads l
          WHERE l.id = p_lead_id AND l.assigned_to = auth.uid()
        )
      )
    ELSE false
  END
$$;

GRANT EXECUTE ON FUNCTION public.wa_ticket_visible(jsonb, uuid, uuid, text[]) TO authenticated;
