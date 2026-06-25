-- Add external_id columns to link Supabase rows back to OpenPhone IDs for idempotent upserts
ALTER TABLE admin_phone_messages ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE admin_phone_calls    ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS admin_phone_messages_external_id_key
  ON admin_phone_messages (external_id) WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_phone_calls_external_id_key
  ON admin_phone_calls (external_id) WHERE external_id IS NOT NULL;

-- Allow upsert by OpenPhone phone number ID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_phone_accounts_quo_account_id_key'
  ) THEN
    ALTER TABLE admin_phone_accounts
      ADD CONSTRAINT admin_phone_accounts_quo_account_id_key UNIQUE (quo_account_id);
  END IF;
END$$;
