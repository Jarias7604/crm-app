-- ─── Google Meet fields for follow_ups ──────────────────────────────────────
-- Stores the Google Calendar event ID, Meet link, and calendar HTML link
-- after a meeting is scheduled directly from the CRM.
-- These fields are NULL for follow-ups created without Google Calendar.

ALTER TABLE follow_ups
  ADD COLUMN IF NOT EXISTS google_event_id     TEXT,
  ADD COLUMN IF NOT EXISTS meet_link           TEXT,
  ADD COLUMN IF NOT EXISTS calendar_html_link  TEXT;

-- Index for fast lookup of follow-ups linked to Google Calendar events
CREATE INDEX IF NOT EXISTS idx_follow_ups_google_event_id
  ON follow_ups (google_event_id)
  WHERE google_event_id IS NOT NULL;
