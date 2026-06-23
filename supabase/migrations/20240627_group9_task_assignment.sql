-- ============================================================
-- GROUP 9: Task assignment — notification RLS extension
-- ============================================================

-- Allow workspace members to insert notifications for other members in the same workspace.
-- Required so that when user A assigns a task to user B, the app can insert a notification
-- for B (user_id = B's id) while authenticated as A.
-- The existing notifications_insert_service policy already covers self-inserts (user_id = auth.uid()).

DROP POLICY IF EXISTS "notifications_insert_assignment" ON admin_notifications;
CREATE POLICY "notifications_insert_assignment"
  ON admin_notifications FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT m2.user_id
      FROM admin_workspace_members m2
      WHERE m2.workspace_id IN (
        SELECT m1.workspace_id
        FROM admin_workspace_members m1
        WHERE m1.user_id = auth.uid()
      )
    )
  );
