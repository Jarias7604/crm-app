-- ============================================================
-- Add advanced escalation + multi-channel hub settings
-- to ai_followup_settings
-- ============================================================

ALTER TABLE public.ai_followup_settings

  -- Original SLA / channel fields
  ADD COLUMN IF NOT EXISTS escalation_channel          text        NOT NULL DEFAULT 'agent_telegram'
    CHECK (escalation_channel IN ('agent_telegram', 'central_telegram', 'slack_webhook')),
  ADD COLUMN IF NOT EXISTS escalation_sla_minutes      int         NOT NULL DEFAULT 30
    CHECK (escalation_sla_minutes BETWEEN 5 AND 1440),
  ADD COLUMN IF NOT EXISTS escalation_backup_agent_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalation_dnd_enabled      bool        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_dnd_start        text        NOT NULL DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS escalation_dnd_end          text        NOT NULL DEFAULT '08:00',

  -- Multi-channel enable toggles
  ADD COLUMN IF NOT EXISTS escalation_ch_agent_tg      bool        NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS escalation_ch_group_tg      bool        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_ch_whatsapp      bool        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_ch_slack         bool        NOT NULL DEFAULT false,

  -- Channel credentials
  ADD COLUMN IF NOT EXISTS escalation_telegram_chat_id  text,
  ADD COLUMN IF NOT EXISTS escalation_whatsapp_number   text,
  ADD COLUMN IF NOT EXISTS escalation_whatsapp_token    text,
  ADD COLUMN IF NOT EXISTS escalation_webhook_url       text,

  -- Department routing (JSONB — per channel per department)
  ADD COLUMN IF NOT EXISTS dept_routing                jsonb       NOT NULL DEFAULT '{
    "sales":      {"telegram": "", "whatsapp": "", "slack": ""},
    "accounting": {"telegram": "", "whatsapp": "", "slack": ""},
    "support":    {"telegram": "", "whatsapp": "", "slack": ""}
  }'::jsonb;

-- Comments for documentation
COMMENT ON COLUMN public.ai_followup_settings.escalation_channel           IS '[Compat] Legacy single-channel field — multi-channel now controlled by escalation_ch_* booleans';
COMMENT ON COLUMN public.ai_followup_settings.escalation_sla_minutes       IS 'Minutes before alert fires if agent has not responded to lead';
COMMENT ON COLUMN public.ai_followup_settings.escalation_backup_agent_id   IS 'Agent to alert as fallback if SLA is breached';
COMMENT ON COLUMN public.ai_followup_settings.escalation_dnd_enabled       IS 'Enable Do Not Disturb window — suppresses alerts outside business hours';
COMMENT ON COLUMN public.ai_followup_settings.escalation_ch_agent_tg       IS 'Send escalation alerts to the assigned agent Telegram directly';
COMMENT ON COLUMN public.ai_followup_settings.escalation_ch_group_tg       IS 'Send escalation alerts to a central Telegram group';
COMMENT ON COLUMN public.ai_followup_settings.escalation_ch_whatsapp       IS 'Send escalation alerts via WhatsApp Business API';
COMMENT ON COLUMN public.ai_followup_settings.escalation_ch_slack          IS 'Send escalation alerts to Slack or Teams via webhook';
COMMENT ON COLUMN public.ai_followup_settings.escalation_telegram_chat_id  IS 'Central Telegram Group chat ID (used when escalation_ch_group_tg = true)';
COMMENT ON COLUMN public.ai_followup_settings.escalation_whatsapp_number   IS 'WhatsApp Business global destination number (international format)';
COMMENT ON COLUMN public.ai_followup_settings.escalation_whatsapp_token    IS 'Meta Cloud API / 360dialog token for WhatsApp notifications';
COMMENT ON COLUMN public.ai_followup_settings.escalation_webhook_url       IS 'Slack/Teams incoming webhook URL for global escalation notifications';
COMMENT ON COLUMN public.ai_followup_settings.dept_routing                 IS 'Per-channel per-department routing: {sales,accounting,support} x {telegram,whatsapp,slack}';
