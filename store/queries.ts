import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { currentStep } from '../domain/chain.js'
import { DEAD_WINDOW_MS } from '../domain/derived.js'
import {
  YOU,
  type Instant,
  type Session,
  type SessionId,
  type Step,
  type Task,
  type TaskState,
} from '../domain/types.js'
import { InvalidTaskIdError, toTaskNumber } from '../shared/task_id.js'
import type { Database } from './database.js'
import { read } from './read.js'
import {
  eventFromRow,
  loadSession,
  loadTaskState,
  stepFromRow,
  taskFromRow,
  type StoredEvent,
} from './rows.js'
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
  /** How many tasks are signed off, of which signedOff holds the latest. */
  signedOffTotal: number
  sessions: ListedSession[]
}

const SIGNED_OFF = 'archived_at IS NULL AND signed_off_at IS NOT NULL'

function signedOffCount(sqlite: DatabaseSync): number {
  return (
    sqlite.prepare(`SELECT count(*) AS total FROM tasks WHERE ${SIGNED_OFF}`).get() as {
      total: number
    }
  ).total
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
        `SELECT * FROM tasks WHERE ${SIGNED_OFF} ORDER BY signed_off_at DESC, id DESC LIMIT ?`
      )
      .all(SIGNED_OFF_SHOWN)
      .map(taskFromRow)
    return {
      revision: revisionOf(sqlite),
      tasks: withSteps(sqlite, open),
      signedOff: withSteps(sqlite, signed),
      signedOffTotal: signedOffCount(sqlite),
      sessions: listSessionRows(sqlite, now, deadWindowMs),
    }
  })
}

export interface HistoryQuery {
  /** From 1. A page past the end gives the last page. */
  page: number
  /** Matches a title, ignoring case, or the task a display id or number names. */
  filter?: string
  pageSize: number
}

export interface HistorySnapshot {
  revision: number
  /** The page given, after clamping to the pages there are. */
  page: number
  /** The signed-off tasks that match, on every page. */
  total: number
  /** This page's tasks, newest sign-off first, with their chains. */
  tasks: TaskState[]
  /** Each agent step's completing session id, by step id. */
  completedBy: Map<string, SessionId>
  /** The names of the sessions completedBy names, removed ones included. */
  sessionNames: Map<SessionId, string>
}

/**
 * The task number a filter names, as T-012, T-12 or 12, or null.
 */
function filteredNumber(filter: string): number | null {
  try {
    return toTaskNumber(filter.toUpperCase())
  } catch (error) {
    if (error instanceof InvalidTaskIdError) return null
    throw error
  }
}

/**
 * One page of the signed-off tasks, newest sign-off first, that match the
 * filter, with the total that match and who completed their agent steps.
 */
export function readHistory(database: Database, query: HistoryQuery): HistorySnapshot {
  const filter = query.filter?.trim() ?? ''
  const matching: { where: string; params: Record<string, SQLInputValue> } =
    filter === ''
      ? { where: SIGNED_OFF, params: {} }
      : {
          where: `${SIGNED_OFF} AND (instr(lower(title), lower(:filter)) > 0 OR id = :number)`,
          params: { filter, number: filteredNumber(filter) },
        }
  return read(database, (sqlite) => {
    const total = (
      sqlite
        .prepare(`SELECT count(*) AS total FROM tasks WHERE ${matching.where}`)
        .get(matching.params) as { total: number }
    ).total
    const pageCount = Math.max(1, Math.ceil(total / query.pageSize))
    const page = Math.min(Math.max(1, Math.floor(query.page)), pageCount)
    const tasks = withSteps(
      sqlite,
      sqlite
        .prepare(
          `SELECT * FROM tasks WHERE ${matching.where}
           ORDER BY signed_off_at DESC, id DESC LIMIT :limit OFFSET :offset`
        )
        .all({ ...matching.params, limit: query.pageSize, offset: (page - 1) * query.pageSize })
        .map(taskFromRow)
    )

    const completedBy = new Map<string, SessionId>()
    const ids = tasks.map(({ task }) => task.id)
    if (ids.length > 0) {
      const completions = sqlite
        .prepare(
          `SELECT step_id, session_id FROM events
           WHERE kind = 'completed' AND step_id IS NOT NULL AND session_id <> ?
             AND task_id IN (${ids.map(() => '?').join(', ')})
           ORDER BY id`
        )
        .all(YOU, ...ids) as Array<{ step_id: string; session_id: string }>
      for (const { step_id: stepId, session_id: sessionId } of completions) {
        completedBy.set(stepId, sessionId)
      }
    }
    const sessionNames = new Map<SessionId, string>()
    for (const id of new Set(completedBy.values())) {
      const session = loadSession(sqlite, id)
      if (session) sessionNames.set(id, session.name)
    }

    return { revision: revisionOf(sqlite), page, total, tasks, completedBy, sessionNames }
  })
}

export interface TaskSnapshot {
  revision: number
  state: TaskState
  /** The task's events, oldest first. */
  events: StoredEvent[]
  /** Every session the task, its steps or its events name, removed ones included. */
  sessions: Session[]
}

/**
 * One task with its chain, its events and the sessions they name, or null when there is no such task.
 */
export function readTask(database: Database, taskId: number): TaskSnapshot | null {
  return read(database, (sqlite) => {
    const state = loadTaskState(sqlite, taskId)
    if (!state) return null
    const events = sqlite
      .prepare('SELECT * FROM events WHERE task_id = ? ORDER BY id')
      .all(taskId)
      .map(eventFromRow)
    const named = new Set<string>()
    for (const id of [state.task.createdBy, state.task.assignedTo, state.task.resumeWith]) {
      if (id !== null) named.add(id)
    }
    for (const step of state.steps) if (step.claimedBy !== null) named.add(step.claimedBy)
    for (const event of events) named.add(event.sessionId)
    const sessions = [...named].flatMap((id) => {
      const session = loadSession(sqlite, id)
      return session ? [session] : []
    })
    return { revision: revisionOf(sqlite), state, events, sessions }
  })
}

export interface Claimable {
  taskId: number
  /** Assigned to the session that asked, rather than unassigned. */
  assigned: boolean
  /** The session that asked handed the task to you, and gets it back. */
  handedBack: boolean
}

export interface ClaimableOptions {
  /**
   * Whether a task handed back to another session may be taken. wait_for_work
   * leaves it to that session, which waits for it; claim_step takes it.
   */
  othersHandBacks?: boolean
}

/**
 * The task claim_step with no task would take for the session: the first
 * queued task, by position, whose current step is a pending agent step and
 * that is assigned to the session; failing that, the first such task whose
 * resumeWith is the session; failing that, the first such task that is
 * unassigned. Never one assigned to another session.
 */
export function firstClaimableIn(
  sqlite: DatabaseSync,
  sessionId: SessionId,
  { othersHandBacks = true }: ClaimableOptions = {}
): Claimable | null {
  const row = sqlite
    .prepare(
      `SELECT tasks.id, tasks.assigned_to, tasks.resume_with FROM tasks
       JOIN steps ON steps.task_id = tasks.id AND steps.number = (
         SELECT min(number) FROM steps AS later WHERE later.task_id = tasks.id AND later.status <> 'done'
       )
       WHERE tasks.status = 'queue' AND tasks.archived_at IS NULL
         AND (tasks.assigned_to = :session OR tasks.assigned_to IS NULL)
         AND (:others OR tasks.resume_with IS NULL OR tasks.resume_with = :session)
         AND steps.owner = 'agent' AND steps.status = 'pending'
       ORDER BY
         CASE WHEN tasks.assigned_to = :session THEN 0 WHEN tasks.resume_with = :session THEN 1 ELSE 2 END,
         tasks.queue_position
       LIMIT 1`
    )
    .get({ session: sessionId, others: othersHandBacks ? 1 : 0 }) as
    { id: number; assigned_to: string | null; resume_with: string | null } | undefined
  return row
    ? {
        taskId: row.id,
        assigned: row.assigned_to !== null,
        handedBack: row.resume_with === sessionId,
      }
    : null
}

/**
 * Your step that a hand-back names: the last of your steps done before the
 * task's current agent step.
 */
export interface HandBack {
  stepNumber: number
  title: string
  note: string | null
  artifactUrl: string | null
}

/**
 * The agent step you rejected, which a task handed back for it names.
 */
export interface Rejected {
  stepNumber: number
  title: string
  note: string
}

export interface Work extends Claimable {
  handBack: HandBack | null
  rejected: Rejected | null
}

/**
 * The work wait_for_work polls for, as a read only: firstClaimableIn without
 * the tasks handed back to other sessions, and for a task handed back to this
 * one, the step you rejected or else your step it names.
 */
export function firstClaimable(database: Database, sessionId: SessionId): Work | null {
  return read(database, (sqlite) => {
    const found = firstClaimableIn(sqlite, sessionId, { othersHandBacks: false })
    if (!found) return null
    if (!found.handedBack) return { ...found, handBack: null, rejected: null }
    const state = loadTaskState(sqlite, found.taskId)!
    const current = currentStep(state.steps)
    if (current.rejection !== null) {
      return {
        ...found,
        handBack: null,
        rejected: { stepNumber: current.number, title: current.title, note: current.rejection },
      }
    }
    const yours = state.steps.findLast((step) => step.owner === 'you' && step.status === 'done')
    return {
      ...found,
      handBack: yours
        ? {
            stepNumber: yours.number,
            title: yours.title,
            note: yours.note,
            artifactUrl: yours.artifactUrl,
          }
        : null,
      rejected: null,
    }
  })
}

export function readRevision(database: Database): number {
  return read(database, revisionOf)
}
