-- PostgREST upsert requires a proper unique CONSTRAINT, not just a unique index.
-- The partial index idx_cal_events_external_id existed but PostgREST couldn't use
-- it as an onConflict target, causing every sync upsert to fail silently.
-- Replace with a real unique constraint (PostgreSQL allows multiple NULLs by
-- default, so manually-created events with null external_event_id are unaffected).

DROP INDEX IF EXISTS idx_cal_events_external_id;

ALTER TABLE admin_calendar_events
  ADD CONSTRAINT uq_cal_events_external
  UNIQUE (calendar_account_id, external_event_id);
