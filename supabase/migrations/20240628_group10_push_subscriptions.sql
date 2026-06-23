-- ============================================================
-- GROUP 10: Push notification subscriptions table
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text      NOT NULL,
  p256dh      text      NOT NULL,
  auth        text      NOT NULL,
  user_agent  text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_push_subscriptions"
  ON push_subscriptions FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
