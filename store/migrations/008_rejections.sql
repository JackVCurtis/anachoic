-- The user may reject a done agent step with a note: the step goes back to
-- pending and keeps the note until it is completed again.
ALTER TABLE steps ADD COLUMN rejection TEXT;

-- A CHECK cannot be altered, so events is rebuilt with the new kind. Nothing
-- references events, and its ids are kept.
CREATE TABLE events_new (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  step_id TEXT REFERENCES steps (id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'added', 'queued', 'reordered', 'claimed', 'started', 'noted', 'asked', 'answered',
    'completed', 'parked', 'released', 'signed_off', 'followed_up', 'archived',
    'assigned', 'unassigned', 'blocked', 'unblocked', 'removed', 'rejected'
  )),
  detail TEXT NOT NULL,
  at TEXT NOT NULL
);

INSERT INTO events_new (id, task_id, step_id, session_id, kind, detail, at)
  SELECT id, task_id, step_id, session_id, kind, detail, at FROM events;

DROP TABLE events;

ALTER TABLE events_new RENAME TO events;

CREATE INDEX events_task ON events (task_id, id);
