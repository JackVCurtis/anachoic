-- The board: one row, holding the revision every committed change bumps and
-- the next task number, which is never reused.
CREATE TABLE board (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  next_task_number INTEGER NOT NULL CHECK (next_task_number >= 1)
);

INSERT INTO board (id, revision, next_task_number) VALUES (1, 0, 1);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY CHECK (id >= 1),
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('backlog', 'queue', 'active', 'done')),
  queue_position INTEGER CHECK (queue_position >= 1),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  finished_at TEXT,
  signed_off_at TEXT,
  archived_at TEXT,
  CHECK (signed_off_at IS NULL OR status = 'done'),
  CHECK (queue_position IS NULL OR (status = 'queue' AND archived_at IS NULL))
);

CREATE UNIQUE INDEX tasks_queue_position ON tasks (queue_position)
  WHERE queue_position IS NOT NULL;

CREATE TABLE steps (
  id TEXT PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  number INTEGER NOT NULL CHECK (number >= 1),
  owner TEXT NOT NULL CHECK (owner IN ('agent', 'you')),
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'waiting', 'done')),
  origin TEXT NOT NULL CHECK (origin IN ('chain', 'follow_up')),
  claimed_by TEXT,
  question TEXT,
  answer TEXT,
  note TEXT,
  summary TEXT,
  links_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(links_json)),
  started_at TEXT,
  running_since TEXT,
  waiting_since TEXT,
  finished_at TEXT,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0 CHECK (elapsed_seconds >= 0),
  waited_seconds INTEGER NOT NULL DEFAULT 0 CHECK (waited_seconds >= 0),
  UNIQUE (task_id, number),
  CHECK (owner = 'agent' OR status <> 'running'),
  CHECK (claimed_by IS NULL OR (owner = 'agent' AND status IN ('running', 'waiting'))),
  CHECK (question IS NULL OR (owner = 'agent' AND status = 'waiting')),
  CHECK ((running_since IS NOT NULL) = (status = 'running')),
  CHECK ((waiting_since IS NOT NULL) = (status = 'waiting'))
);

CREATE INDEX steps_claimed_by ON steps (claimed_by) WHERE claimed_by IS NOT NULL;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY CHECK (id <> 'you'),
  kind TEXT NOT NULL CHECK (kind IN ('dedicated', 'worker')),
  name TEXT NOT NULL,
  project_dir TEXT,
  pid INTEGER NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ended_at TEXT
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  step_id TEXT REFERENCES steps (id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'added', 'queued', 'reordered', 'claimed', 'started', 'noted', 'asked', 'answered',
    'completed', 'parked', 'released', 'signed_off', 'followed_up', 'archived'
  )),
  detail TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE INDEX events_task ON events (task_id, id);
