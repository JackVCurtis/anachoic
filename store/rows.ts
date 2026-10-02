import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { applyQueueEffect } from '../domain/queue_effect.js'
import type { QueueOrder } from '../domain/queue_order.js'
import type { Change } from '../domain/transitions.js'
import type { Event, Link, Session, Step, Task, TaskState } from '../domain/types.js'

/**
 * Between the tables' rows and the domain's entities, and the writes every
 * change makes. Every function here runs inside a transaction the caller
 * holds.
 */

type Row = Record<string, SQLInputValue>

export interface StoredEvent extends Event {
  id: number
}

export function taskFromRow(row: Row): Task {
  return {
    id: row.id as number,
    title: row.title as string,
    status: row.status as Task['status'],
    queuePosition: row.queue_position as number | null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    finishedAt: row.finished_at as string | null,
    signedOffAt: row.signed_off_at as string | null,
    archivedAt: row.archived_at as string | null,
  }
}

export function stepFromRow(row: Row): Step {
  return {
    id: row.id as string,
    taskId: row.task_id as number,
    number: row.number as number,
    owner: row.owner as Step['owner'],
    title: row.title as string,
    detail: row.detail as string | null,
    status: row.status as Step['status'],
    origin: row.origin as Step['origin'],
    claimedBy: row.claimed_by as string | null,
    question: row.question as string | null,
    answer: row.answer as string | null,
    note: row.note as string | null,
    summary: row.summary as string | null,
    links: JSON.parse(row.links_json as string) as Link[],
    startedAt: row.started_at as string | null,
    runningSince: row.running_since as string | null,
    waitingSince: row.waiting_since as string | null,
    finishedAt: row.finished_at as string | null,
    elapsedSeconds: row.elapsed_seconds as number,
    waitedSeconds: row.waited_seconds as number,
  }
}

export function sessionFromRow(row: Row): Session {
  return {
    id: row.id as string,
    kind: row.kind as Session['kind'],
    name: row.name as string,
    projectDir: row.project_dir as string | null,
    pid: row.pid as number,
    firstSeenAt: row.first_seen_at as string,
    lastSeenAt: row.last_seen_at as string,
    endedAt: row.ended_at as string | null,
  }
}

export function eventFromRow(row: Row): StoredEvent {
  return {
    id: row.id as number,
    taskId: row.task_id as number,
    stepId: row.step_id as string | null,
    sessionId: row.session_id as string,
    kind: row.kind as Event['kind'],
    detail: row.detail as string,
    at: row.at as string,
  }
}

export function loadTaskState(sqlite: DatabaseSync, taskId: number): TaskState | null {
  const task = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
  if (!task) return null
  const steps = sqlite.prepare('SELECT * FROM steps WHERE task_id = ? ORDER BY number').all(taskId)
  return { task: taskFromRow(task), steps: steps.map(stepFromRow) }
}

export function loadQueueOrder(sqlite: DatabaseSync): QueueOrder {
  const rows = sqlite
    .prepare('SELECT id, queue_position FROM tasks WHERE queue_position IS NOT NULL')
    .all() as Array<{ id: number; queue_position: number }>
  return new Map(rows.map((row) => [row.id, row.queue_position]))
}

export function loadSession(sqlite: DatabaseSync, id: string): Session | null {
  const row = sqlite.prepare('SELECT * FROM sessions WHERE id = ?').get(id)
  return row ? sessionFromRow(row) : null
}

function writeTask(sqlite: DatabaseSync, task: Task) {
  sqlite
    .prepare(
      `INSERT INTO tasks (id, title, status, queue_position, created_by, created_at, finished_at, signed_off_at, archived_at)
       VALUES (:id, :title, :status, NULL, :created_by, :created_at, :finished_at, :signed_off_at, :archived_at)
       ON CONFLICT (id) DO UPDATE SET
         title = excluded.title, status = excluded.status, queue_position = NULL,
         finished_at = excluded.finished_at, signed_off_at = excluded.signed_off_at,
         archived_at = excluded.archived_at`
    )
    .run({
      id: task.id,
      title: task.title,
      status: task.status,
      created_by: task.createdBy,
      created_at: task.createdAt,
      finished_at: task.finishedAt,
      signed_off_at: task.signedOffAt,
      archived_at: task.archivedAt,
    })
}

function writeStep(sqlite: DatabaseSync, step: Step) {
  sqlite
    .prepare(
      `INSERT INTO steps (id, task_id, number, owner, title, detail, status, origin, claimed_by, question, answer,
         note, summary, links_json, started_at, running_since, waiting_since, finished_at, elapsed_seconds, waited_seconds)
       VALUES (:id, :task_id, :number, :owner, :title, :detail, :status, :origin, :claimed_by, :question, :answer,
         :note, :summary, :links_json, :started_at, :running_since, :waiting_since, :finished_at, :elapsed_seconds, :waited_seconds)
       ON CONFLICT (id) DO UPDATE SET
         status = excluded.status, claimed_by = excluded.claimed_by, question = excluded.question,
         answer = excluded.answer, note = excluded.note, summary = excluded.summary,
         links_json = excluded.links_json, started_at = excluded.started_at,
         running_since = excluded.running_since, waiting_since = excluded.waiting_since,
         finished_at = excluded.finished_at, elapsed_seconds = excluded.elapsed_seconds,
         waited_seconds = excluded.waited_seconds`
    )
    .run({
      id: step.id,
      task_id: step.taskId,
      number: step.number,
      owner: step.owner,
      title: step.title,
      detail: step.detail,
      status: step.status,
      origin: step.origin,
      claimed_by: step.claimedBy,
      question: step.question,
      answer: step.answer,
      note: step.note,
      summary: step.summary,
      links_json: JSON.stringify(step.links),
      started_at: step.startedAt,
      running_since: step.runningSince,
      waiting_since: step.waitingSince,
      finished_at: step.finishedAt,
      elapsed_seconds: step.elapsedSeconds,
      waited_seconds: step.waitedSeconds,
    })
}

/**
 * Rewrites the positions that differ between two orders. Positions are
 * unique, so every changed position is cleared before any is set.
 */
function writeQueueOrder(sqlite: DatabaseSync, before: QueueOrder, after: QueueOrder) {
  const moved = new Set<number>()
  for (const [taskId, position] of before) if (after.get(taskId) !== position) moved.add(taskId)
  for (const [taskId, position] of after) if (before.get(taskId) !== position) moved.add(taskId)
  const clear = sqlite.prepare('UPDATE tasks SET queue_position = NULL WHERE id = ?')
  for (const taskId of moved) clear.run(taskId)
  const set = sqlite.prepare('UPDATE tasks SET queue_position = ? WHERE id = ?')
  for (const taskId of moved) {
    const position = after.get(taskId)
    if (position !== undefined) set.run(position, taskId)
  }
}

export function appendEvents(sqlite: DatabaseSync, events: readonly Event[]) {
  const insert = sqlite.prepare(
    'INSERT INTO events (task_id, step_id, session_id, kind, detail, at) VALUES (?, ?, ?, ?, ?, ?)'
  )
  for (const event of events) {
    insert.run(event.taskId, event.stepId, event.sessionId, event.kind, event.detail, event.at)
  }
}

/**
 * Writes a transition's change: the task and its steps, the queue renumbered
 * by its queue effect, and its events. Returns the task's queue position
 * afterwards, or null.
 */
export function applyChange(sqlite: DatabaseSync, change: Change): number | null {
  const before = loadQueueOrder(sqlite)
  const after = applyQueueEffect(before, change.task.id, change.queue)
  writeTask(sqlite, change.task)
  // writeTask clears the task's own position, so it counts as moved when it stays queued.
  const cleared = new Map(before)
  cleared.delete(change.task.id)
  writeQueueOrder(sqlite, cleared, after)
  for (const step of change.steps) writeStep(sqlite, step)
  appendEvents(sqlite, change.events)
  return after.get(change.task.id) ?? null
}
