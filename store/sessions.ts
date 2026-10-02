import type { DatabaseSync } from 'node:sqlite'
import { DEAD_WINDOW_MS, isLive } from '../domain/derived.js'
import { invalid, isRefusal, refusal, type Refusal } from '../domain/refusal.js'
import { release, unassign } from '../domain/transitions.js'
import {
  DEDICATED_SESSION_ID,
  type Instant,
  type Session,
  type SessionKind,
} from '../domain/types.js'
import { LIMITS } from '../shared/limits.js'
import type { Database } from './database.js'
import { read } from './read.js'
import { applyChange, loadSession, loadTaskState, sessionFromRow } from './rows.js'
import { write, type Written } from './write.js'

export const DEDICATED_NAME = 'This chat'
export const UNNAMED = 'Session'

/**
 * How long an ended session stays on the board, so you can see what it
 * released.
 */
export const RECENTLY_ENDED_MS = 10 * 60 * 1000

export interface Identity {
  id: string
  kind: SessionKind
  projectDir: string | null
}

/**
 * The name a session has until join_board sets one: "This chat" for the
 * dedicated session, and the last segment of a worker's project directory.
 */
export function defaultName(identity: Identity): string {
  if (identity.kind === 'dedicated' || identity.id === DEDICATED_SESSION_ID) return DEDICATED_NAME
  const segment = (identity.projectDir ?? '').split(/[\\/]+/).findLast((part) => part !== '')
  return segment ? segment.slice(0, LIMITS.sessionName.max) : UNNAMED
}

export interface Touched {
  session: Session
  created: boolean
  revived: boolean
}

/**
 * Creates the session's row on first sight, or refreshes when it was last
 * seen and by which process. A session that had ended is live again; the
 * claims released when it ended stay released.
 */
export function touchSessionRow(
  sqlite: DatabaseSync,
  identity: Identity,
  now: Instant,
  pid: number
): Touched {
  const existing = loadSession(sqlite, identity.id)
  if (!existing) {
    sqlite
      .prepare(
        `INSERT INTO sessions (id, kind, name, project_dir, pid, first_seen_at, last_seen_at, ended_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .run(identity.id, identity.kind, defaultName(identity), identity.projectDir, pid, now, now)
  } else {
    sqlite
      .prepare('UPDATE sessions SET last_seen_at = ?, pid = ?, ended_at = NULL WHERE id = ?')
      .run(now, pid, identity.id)
  }
  return {
    session: loadSession(sqlite, identity.id)!,
    created: !existing,
    revived: existing !== null && existing.endedAt !== null,
  }
}

/**
 * touchSessionRow as its own write. The revision moves only when the board
 * shows a difference: a new session, or one that had ended.
 */
export function touchSession(
  database: Database,
  identity: Identity,
  now: Instant,
  pid: number
): Written<Touched> | Refusal {
  return write(database, (sqlite) => touchSessionRow(sqlite, identity, now, pid), {
    keepRevision: (touched) => !touched.created && !touched.revived,
  })
}

/**
 * Touches a worker session that a call names by its id, as one write. An id
 * the board has never seen, or the dedicated session's, is refused, so a
 * call can only name a session the server minted.
 */
export function touchKnownSession(
  database: Database,
  id: string,
  now: Instant,
  pid: number
): Written<Touched> | Refusal {
  return write(
    database,
    (sqlite) => {
      const existing = loadSession(sqlite, id)
      if (!existing || existing.kind !== 'worker') {
        return refusal(
          'not_found',
          `Session ${id} does not exist. Call join_board without session to get a session id.`
        )
      }
      return touchSessionRow(
        sqlite,
        { id, kind: existing.kind, projectDir: existing.projectDir },
        now,
        pid
      )
    },
    { keepRevision: (touched) => !touched.created && !touched.revived }
  )
}

export interface Named {
  id: string
  kind: SessionKind
  name: string
}

export function setSessionName(
  database: Database,
  id: string,
  name: string
): Written<Named> | Refusal {
  const { min, max } = LIMITS.sessionName
  if (name.trim().length < min || name.length > max) {
    return invalid(`name must be ${min} to ${max} characters`)
  }
  return write(database, (sqlite) => {
    const session = loadSession(sqlite, id)
    if (!session) return refusal('not_found', `Session ${id} does not exist`)
    sqlite.prepare('UPDATE sessions SET name = ? WHERE id = ?').run(name, id)
    return { id, kind: session.kind, name }
  })
}

export interface LivenessOptions {
  now: () => Instant
  deadWindowMs?: number
  /**
   * Sessions this process serves, which are alive whatever their row says.
   */
  servedHere?: (sessionId: string) => boolean
}

/**
 * Ends every session not seen within the dead window, releases each step it
 * claimed to the front of the queue with a released event, and clears its
 * assignment from every task assigned to it with an unassigned event.
 * Returns true when it ended any session.
 */
export function releaseDeadSessions(sqlite: DatabaseSync, options: LivenessOptions): boolean {
  const now = options.now()
  const cutoff = new Date(Date.parse(now) - (options.deadWindowMs ?? DEAD_WINDOW_MS)).toISOString()
  const dead = sqlite
    .prepare('SELECT * FROM sessions WHERE ended_at IS NULL AND last_seen_at < ?')
    .all(cutoff)
    .map(sessionFromRow)
    .filter((session) => !options.servedHere?.(session.id))
  if (dead.length === 0) return false

  const names = new Map(
    (
      sqlite.prepare('SELECT id, name FROM sessions').all() as Array<{ id: string; name: string }>
    ).map((row) => [row.id, row.name])
  )
  const claimed = sqlite.prepare(
    "SELECT DISTINCT task_id FROM steps WHERE claimed_by = ? AND status IN ('running', 'waiting') ORDER BY task_id DESC"
  )
  const assigned = sqlite.prepare('SELECT id FROM tasks WHERE assigned_to = ? ORDER BY id')
  for (const session of dead) {
    sqlite.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(now, session.id)
    // Released tasks each join the front, so the lowest task number ends up first.
    for (const { task_id: taskId } of claimed.all(session.id) as Array<{ task_id: number }>) {
      const state = loadTaskState(sqlite, taskId)!
      const outcome = release(state, { actor: session.id, now, nameOf: (id) => names.get(id) })
      if (!isRefusal(outcome)) applyChange(sqlite, outcome)
    }
    for (const { id: taskId } of assigned.all(session.id) as Array<{ id: number }>) {
      const state = loadTaskState(sqlite, taskId)!
      const outcome = unassign(state, { actor: session.id, now, nameOf: (id) => names.get(id) })
      if (!isRefusal(outcome)) applyChange(sqlite, outcome)
    }
  }
  return true
}

/**
 * Registers releaseDeadSessions to run at the start of every write.
 */
export function registerLiveness(database: Database, options: LivenessOptions): void {
  database.writeHooks.push((sqlite) => releaseDeadSessions(sqlite, options))
}

export interface ListedSession {
  session: Session
  live: boolean
  /**
   * The tasks released when the session ended, for one ended recently.
   */
  released: Array<{ id: number; title: string }>
}

export function listSessionRows(
  sqlite: DatabaseSync,
  now: Instant,
  deadWindowMs = DEAD_WINDOW_MS
): ListedSession[] {
  const since = new Date(Date.parse(now) - RECENTLY_ENDED_MS).toISOString()
  const sessions = sqlite
    .prepare(
      'SELECT * FROM sessions WHERE ended_at IS NULL OR ended_at >= ? ORDER BY first_seen_at, id'
    )
    .all(since)
    .map(sessionFromRow)
  const releasedBy = sqlite.prepare(
    `SELECT DISTINCT tasks.id, tasks.title FROM events JOIN tasks ON tasks.id = events.task_id
     WHERE events.kind = 'released' AND events.session_id = ? AND events.at = ? ORDER BY tasks.id`
  )
  return sessions.map((session) => ({
    session,
    live: isLive(session, now, deadWindowMs),
    released:
      session.endedAt === null
        ? []
        : (releasedBy.all(session.id, session.endedAt) as Array<{ id: number; title: string }>),
  }))
}

/**
 * The sessions not ended, and those ended in the last 10 minutes with the
 * tasks released when they ended.
 */
export function listSessions(
  database: Database,
  now: Instant,
  deadWindowMs = DEAD_WINDOW_MS
): ListedSession[] {
  return read(database, (sqlite) => listSessionRows(sqlite, now, deadWindowMs))
}
