-- Maps app users to provider-specific user IDs, such as Quo user IDs.
-- This prevents sending local Supabase/admin_users IDs to external APIs that
-- expect provider-native user identifiers.

CREATE TABLE IF NOT EXISTS admin_user_external_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_user_id text NOT NULL,
  external_email text,
  display_name text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_user_external_identities_provider_check
    CHECK (provider <> ''),
  CONSTRAINT admin_user_external_identities_external_user_id_check
    CHECK (external_user_id <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_user_external_identities_user_provider_key
  ON admin_user_external_identities (workspace_id, user_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS admin_user_external_identities_external_provider_key
  ON admin_user_external_identities (workspace_id, provider, external_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_user_external_identities_provider
  ON admin_user_external_identities (provider);

ALTER TABLE admin_user_external_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view external identities in their workspace"
  ON admin_user_external_identities
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM admin_workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage external identities in their workspace"
  ON admin_user_external_identities
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM admin_workspace_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id
      FROM admin_workspace_members
      WHERE user_id = auth.uid()
    )
  );
