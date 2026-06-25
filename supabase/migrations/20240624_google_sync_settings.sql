-- Multi-calendar sync support
ALTER TABLE admin_calendar_accounts
  ADD COLUMN IF NOT EXISTS available_calendars jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS selected_calendar_ids text[] NOT NULL DEFAULT ARRAY['primary']::text[],
  ADD COLUMN IF NOT EXISTS sync_tokens jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Migrate existing single sync_token into the new per-calendar map
UPDATE admin_calendar_accounts
SET sync_tokens = jsonb_build_object(COALESCE(calendar_id, 'primary'), sync_token)
WHERE sync_token IS NOT NULL AND sync_token <> '';

-- Gmail label filter support
ALTER TABLE admin_gmail_accounts
  ADD COLUMN IF NOT EXISTS available_labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sync_labels text[] NOT NULL DEFAULT ARRAY['INBOX']::text[];
