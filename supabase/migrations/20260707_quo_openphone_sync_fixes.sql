-- Quo/OpenPhone sync reliability fixes
-- Adds normalized external phone, call artifact, and task source fields used by the
-- updated Quo sync edge functions.

ALTER TABLE admin_phone_messages
  ADD COLUMN IF NOT EXISTS external_phone text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conversation_id text,
  ADD COLUMN IF NOT EXISTS message_status text DEFAULT 'received';

DO $$
BEGIN
  ALTER TABLE admin_phone_messages DROP CONSTRAINT IF EXISTS admin_phone_messages_message_status_check;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_phone_messages_message_status_check'
  ) THEN
    ALTER TABLE admin_phone_messages
      ADD CONSTRAINT admin_phone_messages_message_status_check
      CHECK (message_status IN ('queued', 'received', 'sent', 'delivered', 'undelivered', 'failed'));
  END IF;
END$$;

ALTER TABLE admin_phone_calls
  ADD COLUMN IF NOT EXISTS external_phone text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS transcript_text text,
  ADD COLUMN IF NOT EXISTS summary_text text;

ALTER TABLE admin_quo_tasks
  ADD COLUMN IF NOT EXISTS assignee_id text,
  ADD COLUMN IF NOT EXISTS conversation_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

ALTER TABLE admin_tasks
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS admin_tasks_workspace_source_external_id_key
  ON admin_tasks (workspace_id, source, external_id);

CREATE INDEX IF NOT EXISTS idx_phone_messages_external_phone
  ON admin_phone_messages (external_phone)
  WHERE external_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_phone_calls_external_phone
  ON admin_phone_calls (external_phone)
  WHERE external_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_phone_calls_transcript_text
  ON admin_phone_calls USING gin (to_tsvector('english', coalesce(transcript_text, '') || ' ' || coalesce(summary_text, '')));
