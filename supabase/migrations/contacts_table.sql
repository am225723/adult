CREATE TABLE IF NOT EXISTS admin_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  primary_email text,
  primary_phone text,
  company text,
  notes text,
  created_by uuid REFERENCES admin_users(id),
  is_deleted boolean DEFAULT false,
  tags text[],
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_contacts_workspace_id ON admin_contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_admin_contacts_display_name ON admin_contacts(display_name);

ALTER TABLE admin_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_select" ON admin_contacts;
CREATE POLICY "contacts_select" ON admin_contacts FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "contacts_insert" ON admin_contacts;
CREATE POLICY "contacts_insert" ON admin_contacts FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "contacts_update" ON admin_contacts;
CREATE POLICY "contacts_update" ON admin_contacts FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "contacts_delete" ON admin_contacts;
CREATE POLICY "contacts_delete" ON admin_contacts FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));
