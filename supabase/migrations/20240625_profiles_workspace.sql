-- ============================================================
-- GROUP 6: Profiles, multi-workspace RLS, backfill
-- ============================================================

-- 1. Allow users to insert their own admin_users row (upsert support)
DROP POLICY IF EXISTS "users_insert_own" ON admin_users;
CREATE POLICY "users_insert_own"
  ON admin_users FOR INSERT
  WITH CHECK (id = auth.uid());

-- 2. Expand admin_users SELECT to cover all of user's workspaces
DROP POLICY IF EXISTS "users_read_workspace" ON admin_users;
CREATE POLICY "users_read_workspace"
  ON admin_users FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT user_id FROM admin_workspace_members
      WHERE workspace_id IN (
        SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- 3. Allow users to see ALL their own memberships (not just first workspace)
DROP POLICY IF EXISTS "users_read_own_memberships" ON admin_workspace_members;
CREATE POLICY "users_read_own_memberships"
  ON admin_workspace_members FOR SELECT
  USING (user_id = auth.uid());

-- 4. Allow users to see all workspaces they belong to
DROP POLICY IF EXISTS "users_read_own_workspaces" ON admin_workspaces;
CREATE POLICY "users_read_own_workspaces"
  ON admin_workspaces FOR SELECT
  USING (id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

-- 5. Update trigger to sync display_name + avatar_url on new signups
CREATE OR REPLACE FUNCTION admin_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.admin_users (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    display_name = COALESCE(admin_users.display_name, EXCLUDED.display_name),
    avatar_url   = COALESCE(admin_users.avatar_url,   EXCLUDED.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Backfill existing auth.users into admin_users
INSERT INTO public.admin_users (id, email, display_name, avatar_url)
SELECT
  id,
  email,
  COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    split_part(email, '@', 1)
  ),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email        = EXCLUDED.email,
  display_name = COALESCE(admin_users.display_name, EXCLUDED.display_name),
  avatar_url   = COALESCE(admin_users.avatar_url,   EXCLUDED.avatar_url);
