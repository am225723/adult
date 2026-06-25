-- Tighten INSERT RLS to validate workspace_id ownership
DROP POLICY IF EXISTS "saved_searches_insert" ON admin_saved_searches;

CREATE POLICY "saved_searches_insert"
  ON admin_saved_searches FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      workspace_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM admin_workspace_members m
        WHERE m.user_id = auth.uid()
          AND m.workspace_id = admin_saved_searches.workspace_id
      )
    )
  );

-- Add composite index for the dominant read pattern (user + recent-first)
CREATE INDEX IF NOT EXISTS idx_admin_saved_searches_user_created_at
  ON admin_saved_searches (user_id, created_at DESC);
