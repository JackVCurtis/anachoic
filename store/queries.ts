import type { DatabaseSync } from 'node:sqlite'
import { DEAD_WINDOW_MS } from '../domain/derived.js'
import type { Instant, Step, Task, TaskState } from '../domain/types.js'
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

export function readRevision(database: Database): number {
  return read(database, revisionOf)
}
