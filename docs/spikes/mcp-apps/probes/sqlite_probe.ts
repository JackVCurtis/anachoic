import { DatabaseSync } from 'node:sqlite'

export function openProbeDatabase(file: string) {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA synchronous = NORMAL')
  // Schema changes run once, under the write lock, so concurrent openers do not contend on DDL.
  if ((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version === 0) {
    db.exec('BEGIN IMMEDIATE')
    if ((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version === 0) {
      db.exec('CREATE TABLE board (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL)')
      db.exec('INSERT INTO board (id, revision) VALUES (1, 0)')
      db.exec('CREATE TABLE writes (revision INTEGER PRIMARY KEY, label TEXT NOT NULL, at TEXT NOT NULL)')
      db.exec('PRAGMA user_version = 1')
    }
    db.exec('COMMIT')
  }
  return db
}

/** One write: BEGIN IMMEDIATE takes the write lock up front, so the read of the revision and its bump cannot interleave with another process. */
export function bump(db: DatabaseSync, label: string, holdMs = 0) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const { revision } = db.prepare('SELECT revision FROM board WHERE id = 1').get() as { revision: number }
    const next = revision + 1
    db.prepare('UPDATE board SET revision = ? WHERE id = 1').run(next)
    db.prepare('INSERT INTO writes (revision, label, at) VALUES (?, ?, ?)').run(next, label, new Date().toISOString())
    if (holdMs > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, holdMs)
    db.exec('COMMIT')
    return { revision: next }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
