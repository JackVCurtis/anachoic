# 04. Persistence

There is one SQLite database for the whole board. Every server process opens it: the desktop process that serves the dedicated session, and one process per worker session. SQLite's write-ahead log (WAL) makes that safe, under the rules below. The rules were measured in the spike ([notes](../spikes/mcp-apps/notes.md#10-sqlite-with-wal-across-processes)).

## The data directory

| Source | Used when |
|---|---|
| `ANACHOIC_DATA_DIR` | Set. The `.mcpb` manifest sets it, and so does each worker's `claude mcp add` command ([08](08-packaging-and-hosts.md)). |
| `~/Library/Application Support/Anachoic MCP` on macOS, or `$XDG_DATA_HOME/anachoic-mcp` elsewhere | Otherwise |

Desktop starts the server with an empty environment and `/` as the working directory. The server therefore never relies on `HOME`, the working directory or a relative path. If `ANACHOIC_DATA_DIR` is unset and the platform default cannot be resolved, the server refuses to start and writes the reason to stderr.

The directory is created with mode `0700` and holds two things:
- `board.sqlite`, together with its `-wal` and `-shm` files
- `logs/`, for daily server logs ([08](08-packaging-and-hosts.md#logs))

## Opening the database

Each process opens one `DatabaseSync` from `node:sqlite` and keeps it for its lifetime. On open it sets:

| Pragma | Value | Why |
|---|---|---|
| `journal_mode` | `WAL` | Readers never block the writer, and the writer never blocks readers |
| `busy_timeout` | 5000 ms | A writer waits up to 5 s for the write lock |
| `synchronous` | `NORMAL` | Safe with WAL. A power cut can lose the last commit, but never corrupts the database. |
| `foreign_keys` | `ON` | |

**A brand-new file.** `busy_timeout` does not cover switching a new database file to WAL. When several processes create the file at once, `PRAGMA journal_mode = WAL` can fail with "database is locked". Opening therefore retries that pragma for up to 5 s. The spike missed this, because it created the file before starting its processes.

`node:sqlite` prints an ExperimentalWarning on stderr under Node 24. That is harmless, because stdout carries only the protocol.

## Migrations

Migrations are numbered SQL files in `store/migrations/`, applied in order. `PRAGMA user_version` holds the number of the last one applied.

- On open, a process reads `user_version`. If it is behind, the process takes the write lock with `BEGIN IMMEDIATE`, reads `user_version` again, and applies only the migrations still missing, then commits. Two processes that start together therefore never run the same migration twice, and never contend over DDL outside a transaction.
- A process that finds `user_version` **ahead** of its own migrations refuses to start. It says that a newer version of the server owns the database. This is the case when a worker runs an old build.

## Tables

```text
board     (id = 1, revision INTEGER, next_task_number INTEGER)
tasks     (id, title, status, queue_position, created_by, created_at, finished_at, signed_off_at, archived_at)
steps     (id, task_id, number, owner, title, detail, status, origin, claimed_by, question, answer, note,
           summary, links_json, started_at, running_since, waiting_since, finished_at,
           elapsed_seconds, waited_seconds)
sessions  (id, kind, name, project_dir, pid, first_seen_at, last_seen_at, ended_at)
events    (id, task_id, step_id, session_id, kind, detail, at)
```

Uniqueness, foreign keys and checks restate the invariants that SQL can express. Examples are one row per `(task_id, number)`, and `queue_position` unique where it is not null. The rest are checked in `domain/` ([03](03-domain-model.md#invariants)).

## Writing

**Every change is one short transaction.**
1. `BEGIN IMMEDIATE` takes the write lock up front, so a read and the write that depends on it cannot interleave with another process.
2. Read the rows involved, apply the pure rule from `domain/`, write the rows, append the events and bump `board.revision`.
3. `COMMIT`.

The rules that keep this safe:

- **Never hold a transaction across I/O or an `await`.** Each transaction is synchronous from `BEGIN` to `COMMIT`. In the spike, writes held for 50 ms by 8 processes failed with "database is locked". Writes held for 5 ms or less never failed.
- **A lock timeout is a refusal, not a crash.** If `BEGIN IMMEDIATE` waits past `busy_timeout`, the service refuses with `busy` ([03](03-domain-model.md#refusals)) and nothing changes. A tool returns the refusal, and the view shows it ([06](06-tools-and-views.md#errors)).
- **One revision for the whole board.** Each committed change adds one to `board.revision`. Views ask `get_board(sinceRevision)` and receive the board only when it has changed ([06](06-tools-and-views.md#polling)).

## Reading

A read runs without an explicit transaction, or inside a deferred `BEGIN` when it must see one consistent snapshot, as building the board props does. Readers never wait for a writer.

## Retention

Nothing is deleted automatically in phases 0 to 3. Phase 4 adds retention ([09](09-testing-and-build-order.md#phases)):

- **Tasks are never deleted.** Signed-off tasks make up the History view ([14](14-commands-and-history.md#retention)).
- **Sessions** that ended more than 7 days ago are deleted.
- **When it runs.** A process runs retention once a day, in a short transaction, when it is the first to open the database that day.

## Recovery

| Situation | What happens |
|---|---|
| A server process is killed mid-write | SQLite rolls the transaction back. Nothing partial is visible. |
| A worker session dies holding a claim | Its claim is released ([05](05-sessions.md#liveness)) |
| `board.sqlite` cannot be opened, or fails `PRAGMA quick_check` | The server starts. Every tool returns a refusal that names the file and says it is unreadable. The file is never replaced automatically. |
| The database is locked past the timeout | The `busy` refusal. The caller may retry. |
