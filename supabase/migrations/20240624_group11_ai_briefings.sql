CREATE TABLE IF NOT EXISTS admin_ai_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  briefing_date date NOT NULL DEFAULT CURRENT_DATE,
  briefing_text text NOT NULL,
  sources text[] NOT NULL DEFAULT '{}',
  context_snapshot jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One briefing per user per day (upsert on conflict)
CREATE UNIQUE INDEX IF NOT EXISTS admin_ai_briefings_user_date
  ON admin_ai_briefings (user_id, briefing_date);

CREATE INDEX IF NOT EXISTS admin_ai_briefings_user_created
  ON admin_ai_briefings (user_id, created_at DESC);

ALTER TABLE admin_ai_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_briefings"
  ON admin_ai_briefings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
