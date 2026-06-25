-- Headway clinical workflow tables

-- Main workflow tracking table
CREATE TABLE IF NOT EXISTS headway_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  created_by uuid REFERENCES admin_users(id),
  quo_message_id text,
  headway_link text NOT NULL,
  sender_name text,
  status text NOT NULL DEFAULT 'detected'
    CHECK (status IN (
      'detected','opened','data_collected','needs_review',
      'ready_to_create','contact_saved','appointment_created',
      'failed','cancelled'
    )),
  client_data jsonb,
  appointment_data jsonb,
  contact_id uuid REFERENCES admin_contacts(id),
  patientq_patient_id text,
  patientq_appointment_id text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_headway_workflows_workspace ON headway_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_headway_workflows_status ON headway_workflows(status);
CREATE INDEX IF NOT EXISTS idx_headway_workflows_contact ON headway_workflows(contact_id);

ALTER TABLE headway_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "headway_workflows_select" ON headway_workflows;
CREATE POLICY "headway_workflows_select" ON headway_workflows FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "headway_workflows_insert" ON headway_workflows;
CREATE POLICY "headway_workflows_insert" ON headway_workflows FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "headway_workflows_update" ON headway_workflows;
CREATE POLICY "headway_workflows_update" ON headway_workflows FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

-- External references linking contacts to Headway / PatientQ
CREATE TABLE IF NOT EXISTS contact_external_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES admin_contacts(id) ON DELETE CASCADE,
  source text NOT NULL,
  external_id text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_external_refs_contact ON contact_external_refs(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_external_refs_source ON contact_external_refs(source);

ALTER TABLE contact_external_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_external_refs_select" ON contact_external_refs;
CREATE POLICY "contact_external_refs_select" ON contact_external_refs FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "contact_external_refs_insert" ON contact_external_refs;
CREATE POLICY "contact_external_refs_insert" ON contact_external_refs FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "contact_external_refs_update" ON contact_external_refs;
CREATE POLICY "contact_external_refs_update" ON contact_external_refs FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

-- Audit logs for clinical compliance
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES admin_workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES admin_users(id),
  action text NOT NULL,
  resource_type text,
  resource_id text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM admin_workspace_members WHERE user_id = auth.uid()
  ));
