-- Gmail accounts table (similar to calendar_accounts)
CREATE TABLE IF NOT EXISTS admin_gmail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  external_account_email text,
  access_token text, -- encrypted
  refresh_token text, -- encrypted
  token_expires_at timestamp,
  sync_enabled boolean DEFAULT true,
  sync_token text, -- for pagination/incremental sync
  push_channel_id text,
  push_resource_id text,
  push_expiration bigint,
  last_synced_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Email messages table
CREATE TABLE IF NOT EXISTS admin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  gmail_account_id uuid NOT NULL REFERENCES admin_gmail_accounts(id) ON DELETE CASCADE,
  external_message_id text NOT NULL,
  from_addr text,
  to_addr text,
  subject text,
  snippet text,
  body text,
  received_at timestamp,
  is_read boolean DEFAULT false,
  is_starred boolean DEFAULT false,
  labels text[] DEFAULT '{}',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(gmail_account_id, external_message_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_gmail_accounts_user_id ON admin_gmail_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_gmail_accounts_workspace_id ON admin_gmail_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_admin_gmail_accounts_push_channel_id ON admin_gmail_accounts(push_channel_id);
CREATE INDEX IF NOT EXISTS idx_admin_emails_workspace_id ON admin_emails(workspace_id);
CREATE INDEX IF NOT EXISTS idx_admin_emails_gmail_account_id ON admin_emails(gmail_account_id);
CREATE INDEX IF NOT EXISTS idx_admin_emails_received_at ON admin_emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_emails_is_read ON admin_emails(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_emails_is_starred ON admin_emails(is_starred);

-- RLS: Gmail Accounts
ALTER TABLE admin_gmail_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their Gmail accounts"
  ON admin_gmail_accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own Gmail accounts"
  ON admin_gmail_accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their Gmail accounts"
  ON admin_gmail_accounts FOR UPDATE
  USING (user_id = auth.uid());

-- RLS: Emails
ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view emails in their workspace"
  ON admin_emails FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM admin_workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert emails in their workspace"
  ON admin_emails FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id
      FROM admin_workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update emails in their workspace"
  ON admin_emails FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM admin_workspace_members
      WHERE user_id = auth.uid()
    )
  );
