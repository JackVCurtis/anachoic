-- A task may be assigned to one worker, which alone may claim its agent steps.
ALTER TABLE tasks ADD COLUMN assigned_to TEXT REFERENCES sessions (id);

CREATE INDEX tasks_assigned_to ON tasks (assigned_to) WHERE assigned_to IS NOT NULL;

-- A CHECK cannot be altered, so events is rebuilt with the new kinds. Nothing
-- references events, and its ids are kept.
CREATE TABLE events_new (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  step_id TEXT REFERENCES steps (id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'added', 'queued', 'reordered', 'claimed', 'started', 'noted', 'asked', 'answered',
    'completed', 'parked', 'released', 'signed_off', 'followed_up', 'archived',
    'assigned', 'unassigned'
  )),
  detail TEXT NOT NULL,
  at TEXT NOT NULL
);

INSERT INTO events_new (id, task_id, step_id, session_id, kind, detail, at)
  SELECT id, task_id, step_id, session_id, kind, detail, at FROM events;

DROP TABLE events;

ALTER TABLE events_new RENAME TO events;

CREATE INDEX events_task ON events (task_id, id);
