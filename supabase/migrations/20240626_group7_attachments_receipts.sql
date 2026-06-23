-- ============================================================
-- GROUP 7: Message attachments (Storage) + read receipts RLS
-- ============================================================

-- 1. Create private storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  10485760,  -- 10 MB per file
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
    'application/pdf','text/plain','text/csv',
    'application/zip','application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS: workspace members can upload
DROP POLICY IF EXISTS "workspace members upload message attachments" ON storage.objects;
CREATE POLICY "workspace members upload message attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND auth.uid() IN (SELECT user_id FROM admin_workspace_members)
  );

-- 3. Storage RLS: workspace members can download
DROP POLICY IF EXISTS "workspace members read message attachments" ON storage.objects;
CREATE POLICY "workspace members read message attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND auth.uid() IN (SELECT user_id FROM admin_workspace_members)
  );

-- 4. Storage RLS: owners can delete their own uploads
DROP POLICY IF EXISTS "owners delete message attachments" ON storage.objects;
CREATE POLICY "owners delete message attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND owner = auth.uid()
  );

-- 5. Update read receipts RLS to let workspace members see all receipts
--    (needed to show "Seen by N" across the team)
DROP POLICY IF EXISTS "users manage own read receipts" ON admin_message_read_receipts;

DROP POLICY IF EXISTS "users insert own read receipts" ON admin_message_read_receipts;
CREATE POLICY "users insert own read receipts"
  ON admin_message_read_receipts FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users update own read receipts" ON admin_message_read_receipts;
CREATE POLICY "users update own read receipts"
  ON admin_message_read_receipts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users delete own read receipts" ON admin_message_read_receipts;
CREATE POLICY "users delete own read receipts"
  ON admin_message_read_receipts FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "workspace members read receipts" ON admin_message_read_receipts;
CREATE POLICY "workspace members read receipts"
  ON admin_message_read_receipts FOR SELECT
  USING (
    message_id IN (
      SELECT m.id FROM admin_chat_messages m
      JOIN admin_chat_threads t ON t.id = m.thread_id
      WHERE t.workspace_id IN (
        SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
      )
    )
  );
