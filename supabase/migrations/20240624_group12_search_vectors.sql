-- ── Search vectors ────────────────────────────────────────────────────────────

ALTER TABLE admin_contacts
  ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE admin_tasks
  ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE admin_emails
  ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE admin_phone_calls
  ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE admin_phone_messages
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ── GIN indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_contacts_search_vector
  ON admin_contacts USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_tasks_search_vector
  ON admin_tasks USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_emails_search_vector
  ON admin_emails USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_phone_calls_search_vector
  ON admin_phone_calls USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_phone_messages_search_vector
  ON admin_phone_messages USING GIN (search_vector);

-- ── Trigger functions ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_contacts_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.display_name, '') || ' ' ||
    coalesce(NEW.primary_email, '') || ' ' ||
    coalesce(NEW.primary_phone, '') || ' ' ||
    coalesce(NEW.company, '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_tasks_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.notes, '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_emails_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.subject, '') || ' ' ||
    coalesce(NEW.snippet, '') || ' ' ||
    coalesce(NEW.from_address, '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_phone_calls_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.voicemail_transcript, '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_phone_messages_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.body, '')
  );
  RETURN NEW;
END;
$$;

-- ── Triggers ──────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS contacts_search_vector_trigger ON admin_contacts;
CREATE TRIGGER contacts_search_vector_trigger
  BEFORE INSERT OR UPDATE ON admin_contacts
  FOR EACH ROW EXECUTE FUNCTION update_contacts_search_vector();

DROP TRIGGER IF EXISTS tasks_search_vector_trigger ON admin_tasks;
CREATE TRIGGER tasks_search_vector_trigger
  BEFORE INSERT OR UPDATE ON admin_tasks
  FOR EACH ROW EXECUTE FUNCTION update_tasks_search_vector();

DROP TRIGGER IF EXISTS emails_search_vector_trigger ON admin_emails;
CREATE TRIGGER emails_search_vector_trigger
  BEFORE INSERT OR UPDATE ON admin_emails
  FOR EACH ROW EXECUTE FUNCTION update_emails_search_vector();

DROP TRIGGER IF EXISTS phone_calls_search_vector_trigger ON admin_phone_calls;
CREATE TRIGGER phone_calls_search_vector_trigger
  BEFORE INSERT OR UPDATE ON admin_phone_calls
  FOR EACH ROW EXECUTE FUNCTION update_phone_calls_search_vector();

DROP TRIGGER IF EXISTS phone_messages_search_vector_trigger ON admin_phone_messages;
CREATE TRIGGER phone_messages_search_vector_trigger
  BEFORE INSERT OR UPDATE ON admin_phone_messages
  FOR EACH ROW EXECUTE FUNCTION update_phone_messages_search_vector();

-- ── Backfill existing rows ────────────────────────────────────────────────────

UPDATE admin_contacts SET search_vector = to_tsvector('english',
  coalesce(display_name, '') || ' ' ||
  coalesce(primary_email, '') || ' ' ||
  coalesce(primary_phone, '') || ' ' ||
  coalesce(company, '')
);

UPDATE admin_tasks SET search_vector = to_tsvector('english',
  coalesce(title, '') || ' ' || coalesce(notes, '')
);

UPDATE admin_emails SET search_vector = to_tsvector('english',
  coalesce(subject, '') || ' ' ||
  coalesce(snippet, '') || ' ' ||
  coalesce(from_address, '')
);

UPDATE admin_phone_calls SET search_vector = to_tsvector('english',
  coalesce(voicemail_transcript, '')
);

UPDATE admin_phone_messages SET search_vector = to_tsvector('english',
  coalesce(body, '')
);

-- ── search_workspace RPC ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION search_workspace(p_query text, p_limit int DEFAULT 8)
RETURNS TABLE(
  result_type text,
  result_id   uuid,
  title       text,
  subtitle    text,
  rank        real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_tsq          tsquery;
BEGIN
  IF p_query IS NULL OR trim(p_query) = '' THEN
    RETURN;
  END IF;

  SELECT workspace_id INTO v_workspace_id
  FROM admin_workspace_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RETURN;
  END IF;

  v_tsq := websearch_to_tsquery('english', p_query);

  RETURN QUERY
    SELECT
      'contact'::text,
      c.id,
      c.display_name,
      coalesce(c.company, c.primary_email),
      ts_rank(c.search_vector, v_tsq)
    FROM admin_contacts c
    WHERE c.workspace_id = v_workspace_id
      AND NOT c.is_deleted
      AND c.search_vector @@ v_tsq

    UNION ALL

    SELECT
      'task'::text,
      t.id,
      t.title,
      left(t.notes, 100),
      ts_rank(t.search_vector, v_tsq)
    FROM admin_tasks t
    WHERE t.workspace_id = v_workspace_id
      AND t.status NOT IN ('done', 'cancelled')
      AND t.search_vector @@ v_tsq

    UNION ALL

    SELECT
      'email'::text,
      e.id,
      coalesce(e.subject, '(no subject)'),
      e.from_address,
      ts_rank(e.search_vector, v_tsq)
    FROM admin_emails e
    WHERE e.workspace_id = v_workspace_id
      AND e.search_vector @@ v_tsq

    UNION ALL

    SELECT
      'message'::text,
      m.id,
      left(m.body, 60),
      CASE WHEN m.direction = 'incoming' THEN 'Received' ELSE 'Sent' END,
      ts_rank(m.search_vector, v_tsq)
    FROM admin_phone_messages m
    WHERE m.workspace_id = v_workspace_id
      AND m.search_vector @@ v_tsq

    UNION ALL

    SELECT
      'voicemail'::text,
      pc.id,
      'Voicemail'::text,
      left(pc.voicemail_transcript, 80),
      ts_rank(pc.search_vector, v_tsq)
    FROM admin_phone_calls pc
    WHERE pc.workspace_id = v_workspace_id
      AND pc.voicemail_transcript IS NOT NULL
      AND pc.search_vector @@ v_tsq

    ORDER BY rank DESC
    LIMIT p_limit * 6;
END;
$$;

GRANT EXECUTE ON FUNCTION search_workspace(text, int) TO authenticated;
