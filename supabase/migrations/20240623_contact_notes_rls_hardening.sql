-- Make workspace_id NOT NULL (all inserts already supply it)
ALTER TABLE admin_contact_notes
  ALTER COLUMN workspace_id SET NOT NULL;

-- Tighten INSERT: verify contact_id belongs to the same workspace
DROP POLICY IF EXISTS "contact_notes_workspace_insert" ON admin_contact_notes;

CREATE POLICY "contact_notes_workspace_insert" ON admin_contact_notes FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM admin_workspace_members m
      WHERE m.user_id = auth.uid()
        AND m.workspace_id = admin_contact_notes.workspace_id
    )
    AND EXISTS (
      SELECT 1
      FROM admin_contacts c
      WHERE c.id = admin_contact_notes.contact_id
        AND c.workspace_id = admin_contact_notes.workspace_id
    )
  );

-- Tighten UPDATE: add WITH CHECK to prevent post-update tenant drift
DROP POLICY IF EXISTS "contact_notes_owner_update" ON admin_contact_notes;

CREATE POLICY "contact_notes_owner_update" ON admin_contact_notes FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM admin_workspace_members m
      WHERE m.user_id = auth.uid()
        AND m.workspace_id = admin_contact_notes.workspace_id
    )
    AND EXISTS (
      SELECT 1
      FROM admin_contacts c
      WHERE c.id = admin_contact_notes.contact_id
        AND c.workspace_id = admin_contact_notes.workspace_id
    )
  );
