-- ============================================================
-- Fix: Tighten notifications_insert_assignment RLS policy
-- Replaces the over-permissive policy from GROUP 9 with one
-- that binds the check to the row's own workspace_id and
-- restricts type to 'task_assigned' only.
-- ============================================================

DROP POLICY IF EXISTS "notifications_insert_assignment" ON admin_notifications;
CREATE POLICY "notifications_insert_assignment"
  ON admin_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    type = 'task_assigned'
    AND EXISTS (
      SELECT 1 FROM admin_workspace_members me
      WHERE me.workspace_id = admin_notifications.workspace_id
        AND me.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM admin_workspace_members target
      WHERE target.workspace_id = admin_notifications.workspace_id
        AND target.user_id = admin_notifications.user_id
    )
  );
