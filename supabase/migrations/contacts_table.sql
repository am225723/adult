DROP TABLE IF EXISTS admin_contacts CASCADE;

CREATE TABLE admin_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  company text,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX idx_admin_contacts_workspace_id ON admin_contacts(workspace_id);
CREATE INDEX idx_admin_contacts_full_name ON admin_contacts(full_name);

ALTER TABLE admin_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select" ON admin_contacts FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "contacts_insert" ON admin_contacts FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "contacts_update" ON admin_contacts FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "contacts_delete" ON admin_contacts FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));
