-- Add created_by to threads
ALTER TABLE admin_chat_threads
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Thread membership table
CREATE TABLE IF NOT EXISTS admin_chat_thread_members (
  thread_id uuid NOT NULL REFERENCES admin_chat_threads(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

-- Enable RLS
ALTER TABLE admin_chat_threads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_chat_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_chat_thread_members   ENABLE ROW LEVEL SECURITY;

-- admin_chat_threads
DROP POLICY IF EXISTS "workspace members can select threads" ON admin_chat_threads;
CREATE POLICY "workspace members can select threads"
  ON admin_chat_threads FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "workspace members can insert threads" ON admin_chat_threads;
CREATE POLICY "workspace members can insert threads"
  ON admin_chat_threads FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    workspace_id IN (
      SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
    )
  );

-- admin_chat_messages
DROP POLICY IF EXISTS "workspace members can select messages" ON admin_chat_messages;
CREATE POLICY "workspace members can select messages"
  ON admin_chat_messages FOR SELECT
  USING (
    thread_id IN (
      SELECT id FROM admin_chat_threads
      WHERE workspace_id IN (
        SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "workspace members can insert messages" ON admin_chat_messages;
CREATE POLICY "workspace members can insert messages"
  ON admin_chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    thread_id IN (
      SELECT id FROM admin_chat_threads
      WHERE workspace_id IN (
        SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- admin_message_read_receipts
DROP POLICY IF EXISTS "users manage own read receipts" ON admin_message_read_receipts;
CREATE POLICY "users manage own read receipts"
  ON admin_message_read_receipts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- admin_chat_thread_members
DROP POLICY IF EXISTS "workspace members can select thread members" ON admin_chat_thread_members;
CREATE POLICY "workspace members can select thread members"
  ON admin_chat_thread_members FOR SELECT
  USING (
    thread_id IN (
      SELECT id FROM admin_chat_threads
      WHERE workspace_id IN (
        SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "workspace members can join threads" ON admin_chat_thread_members;
CREATE POLICY "workspace members can join threads"
  ON admin_chat_thread_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    thread_id IN (
      SELECT id FROM admin_chat_threads
      WHERE workspace_id IN (
        SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_threads_workspace_created
  ON admin_chat_threads (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created
  ON admin_chat_messages (thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_thread_members_thread
  ON admin_chat_thread_members (thread_id);

CREATE INDEX IF NOT EXISTS idx_chat_thread_members_user
  ON admin_chat_thread_members (user_id);

-- Enable real-time (idempotent)
ALTER TABLE admin_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE admin_chat_threads  REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_chat_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_chat_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_chat_threads;
  END IF;
END $$;
