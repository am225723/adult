-- Saved searches per user
CREATE TABLE IF NOT EXISTS admin_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  query text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'all',
  filters jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_searches_select"
  ON admin_saved_searches FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "saved_searches_insert"
  ON admin_saved_searches FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_searches_delete"
  ON admin_saved_searches FOR DELETE
  USING (user_id = auth.uid());
