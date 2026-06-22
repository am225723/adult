CREATE TABLE IF NOT EXISTS admin_contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES admin_contacts(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_contact_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_notes_workspace_select" ON admin_contact_notes FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "contact_notes_workspace_insert" ON admin_contact_notes FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND workspace_id IN (
      SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "contact_notes_owner_update" ON admin_contact_notes FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "contact_notes_owner_delete" ON admin_contact_notes FOR DELETE
  USING (created_by = auth.uid());

CREATE INDEX idx_contact_notes_contact_id
  ON admin_contact_notes (contact_id, created_at DESC);
