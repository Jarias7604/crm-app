-- ============================================================
-- get_ai_health_metrics — powers the "Costo y Salud de la IA" panel
-- in the AI Agent Cockpit (/marketing/cockpit).
-- 2026-09-01
--
-- Applied directly to production (mtxqqamitglhehaktgxm) on 2026-09-01 —
-- CI migrate-production has been failing since ~2026-07-01. Idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_ai_health_metrics(p_company_id uuid, p_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH msgs AS (
    SELECT m.direction, m.type, m.content, m.metadata, m.created_at
    FROM marketing_messages m
    JOIN marketing_conversations mc ON mc.id = m.conversation_id
    WHERE mc.company_id = p_company_id
      AND m.created_at > now() - make_interval(days => p_days)
  ),
  is_voice AS (
    SELECT * FROM msgs
    WHERE direction = 'inbound'
      AND ( type IN ('audio','voice')
         OR metadata->>'type' IN ('audio','voice')
         OR content ILIKE '%[audio%' OR content ILIKE '%nota de voz%' OR content ILIKE '%🎤%' )
  )
  SELECT jsonb_build_object(
    'days', p_days,
    'ai_replies',        (SELECT count(*) FROM msgs WHERE direction='outbound' AND metadata->>'isAiGenerated'='true'),
    'ai_replies_today',   (SELECT count(*) FROM msgs WHERE direction='outbound' AND metadata->>'isAiGenerated'='true' AND created_at::date = (now() AT TIME ZONE 'America/El_Salvador')::date),
    'canned_replies',     (SELECT count(*) FROM msgs WHERE direction='outbound' AND metadata->>'canned'='true'),
    'voice_notes',        (SELECT count(*) FROM is_voice),
    'inbound_total',      (SELECT count(*) FROM msgs WHERE direction='inbound'),
    'paused_convs',       (SELECT count(*) FROM marketing_conversations WHERE company_id = p_company_id AND metadata->>'ai_paused' = 'true'),
    'junk_leads',         (SELECT count(*) FROM leads WHERE company_id = p_company_id AND status = 'Erróneo' AND updated_at > now() - make_interval(days => p_days)),
    'est_cost_usd', round(
        (SELECT count(*) FROM msgs WHERE direction='outbound' AND metadata->>'isAiGenerated'='true')::numeric * 0.004
      + (SELECT count(*) FROM is_voice)::numeric * 0.01
    , 2)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_health_metrics(uuid, int) TO authenticated, anon, service_role;
