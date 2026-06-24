-- Fix search_workspace:
-- 1. Add ORDER BY to workspace lookup for deterministic results (no silent arbitrary selection)
-- 2. Include tasks with NULL status (SQL NULL NOT IN (...) evaluates to NULL, not TRUE)

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
  ORDER BY workspace_id
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
      AND (t.status NOT IN ('done', 'cancelled') OR t.status IS NULL)
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
