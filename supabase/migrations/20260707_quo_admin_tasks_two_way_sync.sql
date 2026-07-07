-- Add source identity to admin_tasks so Quo-synced tasks can round-trip
-- mutations from the unified task list back to the matching Quo task.

ALTER TABLE admin_tasks
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS external_id text;

-- Supports Supabase upsert with onConflict: "workspace_id,source,external_id".
-- PostgreSQL unique indexes allow multiple NULL external_id values, so app-created
-- tasks without an external source can still coexist normally.
CREATE UNIQUE INDEX IF NOT EXISTS admin_tasks_workspace_source_external_id_key
  ON admin_tasks (workspace_id, source, external_id);

CREATE INDEX IF NOT EXISTS idx_admin_tasks_quo_external_id
  ON admin_tasks (external_id)
  WHERE source = 'quo' AND external_id IS NOT NULL;
