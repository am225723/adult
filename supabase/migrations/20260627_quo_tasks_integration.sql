-- Quo Tasks Integration Tables

-- Table to sync Quo tasks
CREATE TABLE IF NOT EXISTS admin_quo_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  external_id text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  status text NOT NULL CHECK (status IN ('open', 'completed')),
  assigned_to_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  linked_conversation_id text,
  linked_phone_message_id uuid REFERENCES admin_phone_messages(id) ON DELETE SET NULL,
  due_date timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  synced_at timestamp without time zone NOT NULL DEFAULT now(),

  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES admin_workspaces(id)
);

CREATE INDEX idx_quo_tasks_workspace ON admin_quo_tasks(workspace_id);
CREATE INDEX idx_quo_tasks_external_id ON admin_quo_tasks(external_id);
CREATE INDEX idx_quo_tasks_assigned_to ON admin_quo_tasks(assigned_to_id);
CREATE INDEX idx_quo_tasks_phone_message ON admin_quo_tasks(linked_phone_message_id);

-- Table to track Quo contacts synced
CREATE TABLE IF NOT EXISTS admin_quo_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  external_id text NOT NULL UNIQUE,
  first_name text,
  last_name text,
  primary_phone text,
  emails text[],
  company text,
  role text,
  custom_fields jsonb DEFAULT '{}',
  linked_contact_id uuid REFERENCES admin_contacts(id) ON DELETE SET NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  synced_at timestamp without time zone NOT NULL DEFAULT now(),

  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES admin_workspaces(id)
);

CREATE INDEX idx_quo_contacts_workspace ON admin_quo_contacts(workspace_id);
CREATE INDEX idx_quo_contacts_external_id ON admin_quo_contacts(external_id);
CREATE INDEX idx_quo_contacts_phone ON admin_quo_contacts(primary_phone);
CREATE INDEX idx_quo_contacts_linked ON admin_quo_contacts(linked_contact_id);

-- Table to track webhook subscriptions
CREATE TABLE IF NOT EXISTS admin_quo_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  external_id text UNIQUE,
  event_types text[] NOT NULL,
  webhook_url text NOT NULL,
  secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_tested_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),

  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES admin_workspaces(id)
);

CREATE INDEX idx_quo_webhooks_workspace ON admin_quo_webhooks(workspace_id);
CREATE INDEX idx_quo_webhooks_active ON admin_quo_webhooks(is_active);

-- Table to store webhook events for debugging
CREATE TABLE IF NOT EXISTS admin_quo_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  webhook_id uuid NOT NULL REFERENCES admin_quo_webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  processed_at timestamp without time zone,

  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES admin_workspaces(id)
);

CREATE INDEX idx_quo_webhook_events_workspace ON admin_quo_webhook_events(workspace_id);
CREATE INDEX idx_quo_webhook_events_webhook ON admin_quo_webhook_events(webhook_id);
CREATE INDEX idx_quo_webhook_events_processed ON admin_quo_webhook_events(processed);

-- Enhanced phone messages table to link conversations
ALTER TABLE admin_phone_messages ADD COLUMN IF NOT EXISTS conversation_id text;
ALTER TABLE admin_phone_messages ADD COLUMN IF NOT EXISTS message_status text DEFAULT 'received' CHECK (message_status IN ('received', 'sent', 'delivered', 'failed'));
ALTER TABLE admin_phone_messages ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

CREATE INDEX idx_phone_messages_conversation ON admin_phone_messages(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_phone_messages_status ON admin_phone_messages(message_status);

-- RLS Policies

ALTER TABLE admin_quo_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view quo tasks in their workspace" ON admin_quo_tasks
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage quo tasks in their workspace" ON admin_quo_tasks
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE admin_quo_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view quo contacts in their workspace" ON admin_quo_contacts
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage quo contacts in their workspace" ON admin_quo_contacts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE admin_quo_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view quo webhooks in their workspace" ON admin_quo_webhooks
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage quo webhooks in their workspace" ON admin_quo_webhooks
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE admin_quo_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view quo webhook events in their workspace" ON admin_quo_webhook_events
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
    )
  );
