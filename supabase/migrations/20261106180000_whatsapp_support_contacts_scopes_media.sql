-- =============================================================================
-- WhatsApp Support Chat (+503 7971-8911) — contact directory, visibility scopes,
-- media storage and per-role permissions.
--
-- Safety (production-safety.md):
--   * Additive only: new tables/functions/policies. No DROP ... CASCADE.
--   * Does NOT modify FROZEN functions (get_auth_company_id, get_auth_role,
--     auto_set_company_id) — it only CALLS get_auth_company_id().
--   * Every new table has RLS enabled (Regla 12).
--   * No UPDATE on leads.status (Regla 13). Leads are only READ here.
--
-- Visibility model for WhatsApp conversations (tickets with
-- metadata.source = 'whatsapp_evolution'), stored in metadata.wa_scope:
--   soporte        -> clients / client groups      (Tech + Admin)
--   por_clasificar -> unknown numbers              (Vendedor + Admin)
--   lead           -> sales prospects              (assigned Vendedor + Admin)
--   interno        -> own team members             (Admin)
--   spam           -> junk / blocked               (Admin)
-- Non-WhatsApp tickets are NOT affected by these rules.
-- =============================================================================

-- ─── 1. Helpers ──────────────────────────────────────────────────────────────

-- Last 8 digits of a phone (El Salvador numbers are 8 digits) — NULL if shorter.
CREATE OR REPLACE FUNCTION public.wa_last8(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN length(d) >= 8 THEN right(d, 8) END
  FROM (SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') AS d) x
$$;

-- Which WhatsApp scopes the current user may see: {'all'} | {'soporte'} | {'leads'} | {'soporte','leads'} | {}
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
  v_perms  text[] := '{}';
  v_out    text[] := '{}';
BEGIN
  SELECT role::text, custom_role_id, coalesce(is_active, true)
    INTO v_role, v_custom, v_active
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS NULL OR NOT v_active THEN
    RETURN '{}';
  END IF;

  IF v_role IN ('super_admin', 'company_admin') THEN
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

GRANT EXECUTE ON FUNCTION public.wa_viewer_scopes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.wa_last8(text) TO authenticated;

-- Row-level decision for one ticket. Non-WhatsApp tickets always pass.
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
    WHEN p_meta->>'wa_scope' = 'soporte' THEN 'soporte' = ANY (coalesce(p_scopes, '{}'))
    WHEN p_meta->>'wa_scope' = 'por_clasificar' THEN 'leads' = ANY (coalesce(p_scopes, '{}'))
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

-- ─── 2. Tables ───────────────────────────────────────────────────────────────

-- Manual classifications (one row per phone). Automatic detection (groups,
-- clients, leads) is computed live by the webhook; this table only stores
-- what a person decided, so it never goes stale.
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone         text NOT NULL,
  lid           text,
  push_name     text,
  display_name  text,
  contact_type  text NOT NULL CHECK (contact_type IN ('cliente', 'lead', 'interno', 'spam')),
  client_id     uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id       uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  profile_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  group_jid     text,
  notes         text,
  classified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  classified_at timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_contacts_company_phone_key UNIQUE (company_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_last8
  ON public.whatsapp_contacts (company_id, public.wa_last8(phone));
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_lid
  ON public.whatsapp_contacts (company_id, lid) WHERE lid IS NOT NULL;

-- WhatsApp groups and their participants (synced from Evolution by the bridge).
CREATE TABLE IF NOT EXISTS public.whatsapp_groups (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  group_jid              text NOT NULL,
  subject                text,
  client_id              uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  participants           jsonb NOT NULL DEFAULT '[]'::jsonb,
  participants_synced_at timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_groups_company_jid_key UNIQUE (company_id, group_jid)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_participants
  ON public.whatsapp_groups USING gin (participants jsonb_path_ops);

-- One row per WhatsApp message (dedupe by wa_message_id + media tracking).
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ticket_id          uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  comment_id         uuid REFERENCES public.ticket_comments(id) ON DELETE SET NULL,
  wa_message_id      text,
  remote_jid         text,
  from_me            boolean NOT NULL DEFAULT false,
  sender_phone       text,
  sender_name        text,
  message_ts         timestamptz NOT NULL DEFAULT now(),
  message_type       text NOT NULL DEFAULT 'text',
  body               text,
  media_status       text NOT NULL DEFAULT 'none'
                     CHECK (media_status IN ('none', 'pending', 'requested', 'ready', 'failed')),
  media_path         text,
  media_mime         text,
  media_filename     text,
  media_size         bigint,
  media_attempts     integer NOT NULL DEFAULT 0,
  media_requested_at timestamptz,
  media_error        text,
  raw_message        jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_messages_company_wamid_key UNIQUE (company_id, wa_message_id)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_ticket ON public.whatsapp_messages (ticket_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_comment ON public.whatsapp_messages (comment_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_media_queue
  ON public.whatsapp_messages (media_status, created_at)
  WHERE media_status IN ('pending', 'requested');
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_media_path
  ON public.whatsapp_messages (media_path) WHERE media_path IS NOT NULL;

-- Outgoing queue (CRM -> WhatsApp). One row per message so concurrent writers
-- never overwrite each other (previously a JSON array inside ticket metadata).
CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ticket_id     uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  comment_id    uuid REFERENCES public.ticket_comments(id) ON DELETE SET NULL,
  instance      text NOT NULL DEFAULT 'soporte',
  number        text NOT NULL,
  kind          text NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'media')),
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'sent', 'error')),
  wa_message_id text,
  error         text,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  acked_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_queue
  ON public.whatsapp_outbox (status, created_at) WHERE status IN ('pending', 'dispatched');
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_ticket ON public.whatsapp_outbox (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_comment ON public.whatsapp_outbox (comment_id);

-- Internal key/value state for the Evolution bridge (service role only).
CREATE TABLE IF NOT EXISTS public.whatsapp_bridge_state (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup of a conversation by its WhatsApp JID.
CREATE INDEX IF NOT EXISTS idx_tickets_wa_jid
  ON public.tickets (company_id, (metadata->>'whatsapp_jid'))
  WHERE metadata->>'source' = 'whatsapp_evolution';

-- ─── 3. RLS on new tables (Regla 12) ─────────────────────────────────────────

ALTER TABLE public.whatsapp_contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_bridge_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_outbox       ENABLE ROW LEVEL SECURITY;
-- whatsapp_bridge_state: no policies => only service_role can touch it.

-- Delivery status is visible exactly when the conversation is visible (writes: service role only).
DROP POLICY IF EXISTS whatsapp_outbox_select ON public.whatsapp_outbox;
CREATE POLICY whatsapp_outbox_select ON public.whatsapp_outbox
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = whatsapp_outbox.ticket_id));

DROP POLICY IF EXISTS whatsapp_contacts_select ON public.whatsapp_contacts;
CREATE POLICY whatsapp_contacts_select ON public.whatsapp_contacts
  FOR SELECT TO authenticated
  USING (
    (
      company_id = (SELECT public.get_auth_company_id())
      OR company_id IN (SELECT c.id FROM public.companies c WHERE c.parent_company_id = (SELECT public.get_auth_company_id()))
    )
    AND (
      'all' = ANY ((SELECT public.wa_viewer_scopes())::text[])
      OR (contact_type IN ('cliente', 'interno') AND 'soporte' = ANY ((SELECT public.wa_viewer_scopes())::text[]))
      OR 'leads' = ANY ((SELECT public.wa_viewer_scopes())::text[])
    )
  );

DROP POLICY IF EXISTS whatsapp_groups_select ON public.whatsapp_groups;
CREATE POLICY whatsapp_groups_select ON public.whatsapp_groups
  FOR SELECT TO authenticated
  USING (
    (
      company_id = (SELECT public.get_auth_company_id())
      OR company_id IN (SELECT c.id FROM public.companies c WHERE c.parent_company_id = (SELECT public.get_auth_company_id()))
    )
    AND cardinality((SELECT public.wa_viewer_scopes())) > 0
  );

-- A message is visible exactly when its conversation (ticket) is visible.
DROP POLICY IF EXISTS whatsapp_messages_select ON public.whatsapp_messages;
CREATE POLICY whatsapp_messages_select ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = whatsapp_messages.ticket_id));

-- ─── 4. Scope enforcement on existing tickets / ticket_comments ──────────────
-- RESTRICTIVE: combines with AND on top of the existing tenant policies.
-- Non-WhatsApp tickets always pass, so the rest of the Service Hub is unchanged.

DROP POLICY IF EXISTS wa_scope_restrict ON public.tickets;
CREATE POLICY wa_scope_restrict ON public.tickets
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (public.wa_ticket_visible(metadata, lead_id, assigned_to, (SELECT public.wa_viewer_scopes())))
  WITH CHECK (public.wa_ticket_visible(metadata, lead_id, assigned_to, (SELECT public.wa_viewer_scopes())));

DROP POLICY IF EXISTS wa_scope_restrict ON public.ticket_comments;
CREATE POLICY wa_scope_restrict ON public.ticket_comments
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_comments.ticket_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_comments.ticket_id));

-- Every WhatsApp ticket always carries a wa_scope (defaults if a writer forgets it).
CREATE OR REPLACE FUNCTION public.tickets_wa_scope_default()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.metadata->>'source', '') = 'whatsapp_evolution'
     AND coalesce(NEW.metadata->>'wa_scope', '') = '' THEN
    NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
      'wa_scope',
      CASE
        WHEN TG_OP = 'UPDATE' AND coalesce(OLD.metadata->>'wa_scope', '') <> '' THEN OLD.metadata->>'wa_scope'
        WHEN NEW.metadata->>'is_group' = 'true' THEN 'soporte'
        WHEN NEW.metadata->>'support_channel' = 'ventas' THEN 'por_clasificar'
        ELSE 'soporte'
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_wa_scope_default ON public.tickets;
CREATE TRIGGER trg_tickets_wa_scope_default
  BEFORE INSERT OR UPDATE OF metadata ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_wa_scope_default();

-- ─── 5. Private media bucket ─────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('whatsapp-media', 'whatsapp-media', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Read: only files attached to a message the user can see (inherits ticket scope).
DROP POLICY IF EXISTS wa_media_read ON storage.objects;
CREATE POLICY wa_media_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND EXISTS (SELECT 1 FROM public.whatsapp_messages m WHERE m.media_path = storage.objects.name)
  );

-- Upload (outgoing attachments): outgoing/<company_id>/... by users with chat access.
DROP POLICY IF EXISTS wa_media_upload_outgoing ON storage.objects;
CREATE POLICY wa_media_upload_outgoing ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND (storage.foldername(name))[1] = 'outgoing'
    AND (storage.foldername(name))[2] = ((SELECT public.get_auth_company_id()))::text
    AND cardinality((SELECT public.wa_viewer_scopes())) > 0
  );

-- ─── 6. Permissions (configurable per role in Equipo → Roles) ────────────────

INSERT INTO public.permission_definitions (category, permission_key, label, is_system_only)
SELECT v.category, v.permission_key, v.label, false
FROM (VALUES
  ('Soporte', 'wa_chat_soporte', 'Chat WhatsApp: Clientes de Soporte'),
  ('Soporte', 'wa_chat_leads', 'Chat WhatsApp: Leads (Por clasificar + Mis leads)'),
  ('Soporte', 'wa_chat_all', 'Chat WhatsApp: Ver todo (Admin)')
) AS v(category, permission_key, label)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_definitions pd WHERE pd.permission_key = v.permission_key
);

-- Descriptions (column exists in production, not in every environment).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'permission_definitions' AND column_name = 'description'
  ) THEN
    EXECUTE $q$
      UPDATE public.permission_definitions pd SET description = v.d
      FROM (VALUES
        ('wa_chat_soporte', 'Ve solo los chats de clientes y grupos de soporte técnico'),
        ('wa_chat_leads',   'Ve números nuevos por clasificar y los chats de los leads asignados a él'),
        ('wa_chat_all',     'Ve todos los chats: soporte, leads, equipo interno y spam')
      ) AS v(k, d)
      WHERE pd.permission_key = v.k AND pd.description IS NULL
    $q$;
  END IF;
END $$;

-- Seed: roles with Service Hub ('tickets') => Soporte chat only (techs).
INSERT INTO public.role_permissions (role_id, permission_key, is_enabled)
SELECT cr.id, 'wa_chat_soporte', true
FROM public.custom_roles cr
WHERE EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_id = cr.id AND rp.permission_key = 'tickets' AND rp.is_enabled = true
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Seed: sales roles (leads access, no Service Hub) => Leads chat.
INSERT INTO public.role_permissions (role_id, permission_key, is_enabled)
SELECT cr.id, 'wa_chat_leads', true
FROM public.custom_roles cr
WHERE EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_id = cr.id AND rp.is_enabled = true
    AND rp.permission_key IN ('leads', 'leads_view', 'leads_view_all', 'leads_view_assigned')
)
AND NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_id = cr.id AND rp.permission_key = 'tickets' AND rp.is_enabled = true
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- ─── 7. Backfill wa_scope on existing WhatsApp conversations ─────────────────
-- Same rules the webhook applies: group => soporte; client phone or lead in
-- Cerrado/Cliente => soporte; lead Erróneo => spam; other lead => lead;
-- unknown => por_clasificar. Only tickets.metadata is touched (no leads changes).

WITH wa AS (
  SELECT t.id, t.company_id, t.lead_id, t.metadata,
         public.wa_last8(t.metadata->>'whatsapp_phone') AS last8,
         (t.metadata->>'is_group' = 'true' OR coalesce(t.metadata->>'whatsapp_jid', '') LIKE '%@g.us') AS is_group
  FROM public.tickets t
  WHERE t.metadata->>'source' = 'whatsapp_evolution'
    AND coalesce(t.metadata->>'wa_scope', '') = ''
),
resolved AS (
  SELECT wa.id,
    CASE
      WHEN wa.is_group THEN 'soporte'
      WHEN wc.contact_type = 'cliente' THEN 'soporte'
      WHEN wc.contact_type IN ('lead', 'interno', 'spam') THEN wc.contact_type
      WHEN EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.company_id = wa.company_id AND wa.last8 IS NOT NULL
          AND public.wa_last8(c.telefono) = wa.last8
      ) THEN 'soporte'
      WHEN ld.status IN ('Cerrado', 'Cliente') OR ld.es_cliente THEN 'soporte'
      WHEN ld.status = 'Erróneo' THEN 'spam'
      WHEN ld.id IS NOT NULL THEN 'lead'
      ELSE 'por_clasificar'
    END AS scope,
    ld.id AS matched_lead_id
  FROM wa
  LEFT JOIN LATERAL (
    SELECT w.contact_type FROM public.whatsapp_contacts w
    WHERE w.company_id = wa.company_id AND wa.last8 IS NOT NULL AND public.wa_last8(w.phone) = wa.last8
    LIMIT 1
  ) wc ON true
  LEFT JOIN LATERAL (
    SELECT l.id, l.status, l.es_cliente FROM public.leads l
    WHERE l.company_id = wa.company_id
      AND (l.id = wa.lead_id OR (wa.last8 IS NOT NULL AND public.wa_last8(l.phone) = wa.last8))
    ORDER BY (l.id = wa.lead_id) DESC NULLS LAST, l.created_at DESC
    LIMIT 1
  ) ld ON NOT wa.is_group
)
UPDATE public.tickets t
SET metadata = t.metadata || jsonb_build_object(
      'wa_scope', r.scope,
      'support_channel', CASE WHEN r.scope = 'soporte' THEN coalesce(nullif(t.metadata->>'support_channel', 'ventas'), 'soporte') ELSE 'ventas' END,
      'is_existing_client', r.scope = 'soporte'
    ),
    lead_id = CASE WHEN r.scope IN ('lead', 'spam') AND t.lead_id IS NULL THEN r.matched_lead_id ELSE t.lead_id END
FROM resolved r
WHERE t.id = r.id;

-- ─── 8. Exactly one OPEN conversation per WhatsApp chat ──────────────────────
-- Two messages arriving in the same second used to create two tickets (race).
-- Merge any existing duplicates into the most recently active one, then
-- enforce it with a unique partial index (the webhook retries on conflict).

WITH ranked AS (
  SELECT t.id,
         first_value(t.id) OVER w AS keep_id,
         row_number() OVER w AS rn
  FROM public.tickets t
  WHERE t.metadata->>'source' = 'whatsapp_evolution'
    AND t.status IN ('new', 'open', 'pending')
    AND coalesce(t.metadata->>'whatsapp_jid', '') <> ''
  WINDOW w AS (PARTITION BY t.company_id, t.metadata->>'whatsapp_jid' ORDER BY t.updated_at DESC, t.id)
),
dups AS (
  SELECT id, keep_id FROM ranked WHERE rn > 1
),
moved AS (
  UPDATE public.ticket_comments c
  SET ticket_id = d.keep_id
  FROM dups d
  WHERE c.ticket_id = d.id
  RETURNING c.id
)
UPDATE public.tickets t
SET status = 'closed',
    last_status_change_at = now(),
    metadata = t.metadata || jsonb_build_object(
      'merged_into', d.keep_id,
      'merged_reason', 'duplicate_open_whatsapp_conversation'
    )
FROM dups d
WHERE t.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_open_ticket_per_chat
  ON public.tickets (company_id, (metadata->>'whatsapp_jid'))
  WHERE metadata->>'source' = 'whatsapp_evolution'
    AND status IN ('new', 'open', 'pending')
    AND coalesce(metadata->>'whatsapp_jid', '') <> '';

-- ─── 9. Remove the Evolution API key that older versions copied into tickets ─
-- (readable by any user of the company). The key now lives only in the
-- function secret / service-role-only whatsapp_bridge_state.
UPDATE public.tickets t
SET metadata = (t.metadata - 'evolution_apikey' - 'pending_audio_jobs' - 'last_bridge_evo_response')
  || jsonb_build_object(
       'pending_whatsapp_outbox',
       coalesce((
         SELECT jsonb_agg(i - 'apikey')
         FROM jsonb_array_elements(
           CASE WHEN jsonb_typeof(t.metadata->'pending_whatsapp_outbox') = 'array'
                THEN t.metadata->'pending_whatsapp_outbox' ELSE '[]'::jsonb END
         ) i
       ), '[]'::jsonb)
     )
WHERE t.metadata->>'source' = 'whatsapp_evolution'
  AND (t.metadata ? 'evolution_apikey'
       OR t.metadata ? 'pending_audio_jobs'
       OR t.metadata ? 'last_bridge_evo_response'
       OR t.metadata::text LIKE '%"apikey"%');

-- ─── 10. Realtime: the chat screen updates live (RLS still applies per user) ─
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['tickets', 'ticket_comments', 'whatsapp_messages', 'whatsapp_outbox'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- Seed whatsapp_groups from existing group conversations (participants come later from the bridge sync).
INSERT INTO public.whatsapp_groups (company_id, group_jid, subject)
SELECT DISTINCT ON (t.company_id, t.metadata->>'whatsapp_jid')
       t.company_id, t.metadata->>'whatsapp_jid', nullif(t.metadata->>'whatsapp_group_subject', '')
FROM public.tickets t
WHERE t.metadata->>'source' = 'whatsapp_evolution'
  AND coalesce(t.metadata->>'whatsapp_jid', '') LIKE '%@g.us'
ORDER BY t.company_id, t.metadata->>'whatsapp_jid', t.updated_at DESC
ON CONFLICT (company_id, group_jid) DO NOTHING;
