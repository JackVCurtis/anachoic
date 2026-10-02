import type { DatabaseSync } from 'node:sqlite'
import { DEAD_WINDOW_MS } from '../domain/derived.js'
import type { Instant, SessionId, Step, Task, TaskState } from '../domain/types.js'
import type { Database } from './database.js'
import { read } from './read.js'
import { eventFromRow, loadTaskState, stepFromRow, taskFromRow, type StoredEvent } from './rows.js'
import { listSessionRows, type ListedSession } from './sessions.js'

/**
 * The board shows this many of the most recently signed-off tasks.
 */
export const SIGNED_OFF_SHOWN = 10

export interface BoardSnapshot {
  revision: number
  /** Every task not archived and not signed off, with its chain, by number. */
  tasks: TaskState[]
  /** The most recently signed-off tasks, latest first. */
  signedOff: TaskState[]
  sessions: ListedSession[]
}

function revisionOf(sqlite: DatabaseSync): number {
  return (sqlite.prepare('SELECT revision FROM board WHERE id = 1').get() as { revision: number })
    .revision
}

function withSteps(sqlite: DatabaseSync, tasks: Task[]): TaskState[] {
  if (tasks.length === 0) return []
  const ids = tasks.map((task) => task.id)
  const steps = sqlite
    .prepare(
      `SELECT * FROM steps WHERE task_id IN (${ids.map(() => '?').join(', ')}) ORDER BY task_id, number`
    )
    .all(...ids)
    .map(stepFromRow)
  const byTask = new Map<number, Step[]>()
  for (const step of steps) byTask.set(step.taskId, [...(byTask.get(step.taskId) ?? []), step])
  return tasks.map((task) => ({ task, steps: byTask.get(task.id) ?? [] }))
}

/**
 * Everything the board props are built from, in one snapshot.
 */
export function readBoard(
  database: Database,
  now: Instant,
  deadWindowMs = DEAD_WINDOW_MS
): BoardSnapshot {
  return read(database, (sqlite) => {
    const open = sqlite
      .prepare(
        'SELECT * FROM tasks WHERE archived_at IS NULL AND signed_off_at IS NULL ORDER BY id'
      )
      .all()
      .map(taskFromRow)
    const signed = sqlite
      .prepare(
        'SELECT * FROM tasks WHERE archived_at IS NULL AND signed_off_at IS NOT NULL ORDER BY signed_off_at DESC, id DESC LIMIT ?'
      )
      .all(SIGNED_OFF_SHOWN)
      .map(taskFromRow)
    return {
      revision: revisionOf(sqlite),
      tasks: withSteps(sqlite, open),
      signedOff: withSteps(sqlite, signed),
      sessions: listSessionRows(sqlite, now, deadWindowMs),
    }
  })
}

export interface TaskSnapshot {
  revision: number
  state: TaskState
  /** The task's events, oldest first. */
  events: StoredEvent[]
}

/**
 * One task with its chain and its events, or null when there is no such task.
 */
export function readTask(database: Database, taskId: number): TaskSnapshot | null {
  return read(database, (sqlite) => {
    const state = loadTaskState(sqlite, taskId)
    if (!state) return null
    const events = sqlite
      .prepare('SELECT * FROM events WHERE task_id = ? ORDER BY id')
      .all(taskId)
      .map(eventFromRow)
    return { revision: revisionOf(sqlite), state, events }
  })
}

export interface Claimable {
  taskId: number
  /** Assigned to the session that asked, rather than unassigned. */
  assigned: boolean
}

/**
 * The task claim_step with no task would take for the session: the first
 * queued task, by position, whose current step is a pending agent step and
 * that is assigned to the session; failing that, the first such task that is
 * unassigned. Never one assigned to another session.
 */
export function firstClaimableIn(sqlite: DatabaseSync, sessionId: SessionId): Claimable | null {
  const row = sqlite
    .prepare(
      `SELECT tasks.id, tasks.assigned_to FROM tasks
       JOIN steps ON steps.task_id = tasks.id AND steps.number = (
         SELECT min(number) FROM steps AS later WHERE later.task_id = tasks.id AND later.status <> 'done'
       )
       WHERE tasks.status = 'queue' AND tasks.archived_at IS NULL
         AND (tasks.assigned_to = :session OR tasks.assigned_to IS NULL)
         AND steps.owner = 'agent' AND steps.status = 'pending'
       ORDER BY tasks.assigned_to IS NULL, tasks.queue_position
       LIMIT 1`
    )
    .get({ session: sessionId }) as { id: number; assigned_to: string | null } | undefined
  return row ? { taskId: row.id, assigned: row.assigned_to !== null } : null
}

/**
 * firstClaimableIn as a read only, which wait_for_work polls.
 */
export function firstClaimable(database: Database, sessionId: SessionId): Claimable | null {
  return read(database, (sqlite) => firstClaimableIn(sqlite, sessionId))
}

export function readRevision(database: Database): number {
  return read(database, revisionOf)
}
