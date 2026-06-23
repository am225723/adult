-- Ensure RLS is enabled on notifications tables
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notification_preferences ENABLE ROW LEVEL SECURITY;

-- admin_notifications policies
DROP POLICY IF EXISTS "notifications_select_own" ON admin_notifications;
CREATE POLICY "notifications_select_own" ON admin_notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON admin_notifications;
CREATE POLICY "notifications_update_own" ON admin_notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System/service role can insert notifications; regular users cannot create their own
DROP POLICY IF EXISTS "notifications_insert_service" ON admin_notifications;
CREATE POLICY "notifications_insert_service" ON admin_notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- admin_notification_preferences policies
DROP POLICY IF EXISTS "notification_prefs_select_own" ON admin_notification_preferences;
CREATE POLICY "notification_prefs_select_own" ON admin_notification_preferences FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_prefs_insert_own" ON admin_notification_preferences;
CREATE POLICY "notification_prefs_insert_own" ON admin_notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_prefs_update_own" ON admin_notification_preferences;
CREATE POLICY "notification_prefs_update_own" ON admin_notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_prefs_delete_own" ON admin_notification_preferences;
CREATE POLICY "notification_prefs_delete_own" ON admin_notification_preferences FOR DELETE
  USING (user_id = auth.uid());

-- Index to speed up notification lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON admin_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user
  ON admin_notification_preferences (user_id);
