import type { DatabaseSync } from 'node:sqlite'
import { currentStep } from '../domain/chain.js'
import {
  invalid,
  isRefusal,
  notALiveWorker,
  nothingToClaim,
  notFound,
  wrongStepStatus,
  type Refusal,
} from '../domain/refusal.js'
import * as transitions from '../domain/transitions.js'
import type { Context, Outcome, Placement } from '../domain/transitions.js'
import type { Actor, Event, Instant, Link, StepInput, TaskState } from '../domain/types.js'
import {
  checkLinks,
  checkOptionalText,
  checkSteps,
  checkText,
  firstRefusal,
} from '../domain/validate.js'
import { formatTaskId, InvalidTaskIdError, toTaskNumber } from '../shared/task_id.js'
import type { Database } from './database.js'
import { firstClaimableIn } from './queries.js'
import { read } from './read.js'
import { applyChange, loadSession, loadTaskState } from './rows.js'
import { write, type Written } from './write.js'

/**
 * One function per action on the board. Each is one write: it reads the rows
 * involved, applies the domain's transition and queue order, writes the rows
 * and events and bumps the revision, or refuses and changes nothing.
 */

/**
 * A task as a tool names it: T-012, 12 or "12".
 */
export type TaskRef = string | number

export interface Acted {
  /** The task and its chain after the change, with its queue position. */
  state: TaskState
  /** The events the change appended, in order. */
  events: Event[]
}

export type ServiceResult<T = Acted> = Written<T> | Refusal

function taskNumber(ref: TaskRef): number | Refusal {
  try {
    return toTaskNumber(ref)
  } catch (error) {
    if (error instanceof InvalidTaskIdError)
      return invalid(`task must be a task id such as T-012, not “${ref}”`)
    throw error
  }
}

function contextFor(sqlite: DatabaseSync, actor: Actor, now: Instant): Context {
  const name = sqlite.prepare('SELECT name FROM sessions WHERE id = ?')
  return {
    actor,
    now,
    nameOf: (id) => (name.get(id) as { name: string } | undefined)?.name,
  }
}

/**
 * Applies a transition's outcome and returns the task as it now is.
 */
function commit(sqlite: DatabaseSync, outcome: Outcome): Acted | Refusal {
  if (isRefusal(outcome)) return outcome
  const queuePosition = applyChange(sqlite, outcome)
  return {
    state: { task: { ...outcome.task, queuePosition }, steps: outcome.steps },
    events: outcome.events,
  }
}

/**
 * The write every service on an existing task makes: check the input, load
 * the task, apply the transition.
 */
function act(
  database: Database,
  actor: Actor,
  now: Instant,
  ref: TaskRef,
  apply: (state: TaskState, ctx: Context) => Outcome,
  checked: Refusal | null = null
): ServiceResult {
  const id = taskNumber(ref)
  if (isRefusal(id)) return id
  if (checked) return checked
  return write(database, (sqlite) => {
    const state = loadTaskState(sqlite, id)
    if (!state) return notFound(id)
    return commit(sqlite, apply(state, contextFor(sqlite, actor, now)))
  })
}

export interface AddTaskInput {
  title: string
  steps: StepInput[]
  /** Add to the queue, rather than the backlog. */
  queue?: boolean
  /** The id of the live worker the task is assigned to. */
  assignTo?: string | null
}

/**
 * Add, or Add to queue. The task takes the next number, which is never
 * reused, and is created by the session or by you. A task may be assigned
 * only to a live worker.
 */
export function addTask(
  database: Database,
  actor: Actor,
  now: Instant,
  input: AddTaskInput
): ServiceResult {
  const refused = firstRefusal(checkText('title', input.title), checkSteps(input.steps))
  if (refused) return refused
  return write(database, (sqlite) => {
    const assignTo = input.assignTo ?? null
    if (assignTo !== null) {
      const worker = loadSession(sqlite, assignTo)
      if (!worker || worker.kind !== 'worker' || worker.endedAt !== null) {
        return notALiveWorker(worker?.name ?? assignTo)
      }
    }
    const { next_task_number: taskId } = sqlite
      .prepare('SELECT next_task_number FROM board WHERE id = 1')
      .get() as { next_task_number: number }
    sqlite.prepare('UPDATE board SET next_task_number = next_task_number + 1 WHERE id = 1').run()
    const ctx = contextFor(sqlite, actor, now)
    const task = { taskId, title: input.title, steps: input.steps, assignTo }
    return commit(
      sqlite,
      (input.queue ?? true) ? transitions.addToQueue(task, ctx) : transitions.add(task, ctx)
    )
  })
}

export function queueTask(
  database: Database,
  actor: Actor,
  now: Instant,
  task: TaskRef
): ServiceResult {
  return act(database, actor, now, task, transitions.queue)
}

export function reorderQueue(
  database: Database,
  actor: Actor,
  now: Instant,
  task: TaskRef,
  position: number
): ServiceResult {
  const checked =
    Number.isSafeInteger(position) && position >= 1
      ? null
      : invalid('position must be a whole number from 1')
  return act(
    database,
    actor,
    now,
    task,
    (state, ctx) => transitions.reorder(state, ctx, position),
    checked
  )
}

/**
 * Claims the current agent step of the queued task named, wherever it sits;
 * or, with no task, of the first task the session may claim, those assigned
 * to it first. The write lock makes a claim atomic, so two sessions never
 * take the same step.
 */
export function claimStep(
  database: Database,
  actor: Actor,
  now: Instant,
  task?: TaskRef
): ServiceResult {
  if (task !== undefined) return act(database, actor, now, task, transitions.claim)
  return write(database, (sqlite) => {
    const claimable = firstClaimableIn(sqlite, actor)
    if (!claimable) return nothingToClaim()
    const state = loadTaskState(sqlite, claimable.taskId)!
    return commit(sqlite, transitions.claim(state, contextFor(sqlite, actor, now)))
  })
}

export interface UpdateStepInput {
  note: string
  links?: Link[]
}

export function updateStep(
  database: Database,
  actor: Actor,
  now: Instant,
  task: TaskRef,
  input: UpdateStepInput
): ServiceResult {
  const checked = firstRefusal(checkText('note', input.note), checkLinks(input.links))
  return act(
    database,
    actor,
    now,
    task,
    (state, ctx) => transitions.note(state, ctx, input),
    checked
  )
}

export function askYou(
  database: Database,
  actor: Actor,
  now: Instant,
  task: TaskRef,
  question: string
): ServiceResult {
  return act(
    database,
    actor,
    now,
    task,
    (state, ctx) => transitions.ask(state, ctx, question),
    checkText('question', question)
  )
}

export function answerQuestion(
  database: Database,
  actor: Actor,
  now: Instant,
  task: TaskRef,
  answer: string
): ServiceResult {
  return act(
    database,
    actor,
    now,
    task,
    (state, ctx) => transitions.answer(state, ctx, answer),
    checkText('answer', answer)
  )
}

export interface CompleteStepInput {
  summary: string
  links?: Link[]
}

export function completeStep(
  database: Database,
  actor: Actor,
  now: Instant,
  task: TaskRef,
  input: CompleteStepInput
): ServiceResult {
  const checked = firstRefusal(checkText('summary', input.summary), checkLinks(input.links))
  return act(
    database,
    actor,
    now,
    task,
    (state, ctx) => transitions.completeStep(state, ctx, input),
    checked
  )
}

export function completeMyStep(
  database: Database,
  actor: Actor,
  now: Instant,
  task: TaskRef,
  input: transitions.CompleteMyStepInput = {}
): ServiceResult {
  const note = input.note === '' ? null : input.note
  return act(
    database,
    actor,
    now,
    task,
    (state, ctx) =>
      transitions.completeMyStep(state, ctx, { note, artifactUrl: input.artifactUrl }),
    checkOptionalText('note', note)
  )
}

/**
 * Parks an active task, or moves a queued task back to the backlog.
 */
export function moveToBacklog(
  database: Database,
  actor: Actor,
  now: Instant,
  task: TaskRef
): ServiceResult {
  return act(database, actor, now, task, transitions.moveToBacklog)
}

export function signOff(
  database: Database,
  actor: Actor,
  now: Instant,
  task: TaskRef
): ServiceResult {
  return act(database, actor, now, task, transitions.signOff)
}

export interface FollowUpInput {
  steps: StepInput[]
  placement: Placement
}

export function addFollowUp(
  database: Database,
  actor: Actor,
  now: Instant,
  task: TaskRef,
  input: FollowUpInput
): ServiceResult {
  const checked = firstRefusal(
    checkSteps(input.steps),
    input.placement === 'first' || input.placement === 'last'
      ? null
      : invalid('placement must be first or last')
  )
  return act(
    database,
    actor,
    now,
    task,
    (state, ctx) => transitions.followUp(state, ctx, input),
    checked
  )
}

export function archiveTask(
  database: Database,
  actor: Actor,
  now: Instant,
  task: TaskRef
): ServiceResult {
  return act(database, actor, now, task, transitions.archive)
}

/**
 * Where a worker's wait for your answer stands.
 */
export type AnswerState =
  | { kind: 'answered'; answer: string }
  | { kind: 'waiting' }
  | { kind: 'none' }
  | { kind: 'ended'; reason: 'parked' | 'archived' | 'ended'; sentence: string }

function answerStateOf(state: TaskState | null, taskId: number, session: string): AnswerState {
  const id = formatTaskId(taskId)
  if (!state) return { kind: 'ended', reason: 'ended', sentence: `${id} does not exist` }
  if (state.task.archivedAt !== null) {
    return { kind: 'ended', reason: 'archived', sentence: `${id} was archived. Stop work on it.` }
  }
  const step = currentStep(state.steps)
  if (step.owner !== 'agent' || step.claimedBy !== session) {
    return state.task.status === 'backlog'
      ? { kind: 'ended', reason: 'parked', sentence: `${id} was parked. Stop work on it.` }
      : {
          kind: 'ended',
          reason: 'ended',
          sentence: `Your claim on ${id} has ended. Stop work on it.`,
        }
  }
  if (step.status === 'waiting') return { kind: 'waiting' }
  return step.answer === null ? { kind: 'none' } : { kind: 'answered', answer: step.answer }
}

/**
 * Whether the session may wait for an answer on the task: the current step
 * is its claimed step, and it waits on you or holds an answer not yet
 * collected. A read only.
 */
export function checkWaiting(database: Database, task: TaskRef, session: string): Refusal | null {
  const id = taskNumber(task)
  if (isRefusal(id)) return id
  return read(database, (sqlite) => {
    const state = loadTaskState(sqlite, id)
    if (!state) return notFound(id)
    const refused = transitions.preconditions.held(state, contextFor(sqlite, session, ''))
    if (refused) return refused
    const step = currentStep(state.steps)
    return step.status === 'waiting' || step.answer !== null
      ? null
      : wrongStepStatus(
          id,
          step.number,
          'has no question waiting for an answer. Call ask_you first.'
        )
  })
}

/**
 * The read-only check wait_for_answer polls.
 */
export function readAnswerState(
  database: Database,
  task: TaskRef,
  session: string
): AnswerState | Refusal {
  const id = taskNumber(task)
  if (isRefusal(id)) return id
  return read(database, (sqlite) => answerStateOf(loadTaskState(sqlite, id), id, session))
}

/**
 * Returns your answer to the session's question and clears it, so it is
 * collected once; or says the session's claim ended, and why.
 */
export function collectAnswer(
  database: Database,
  task: TaskRef,
  session: string
): ServiceResult<AnswerState> {
  const id = taskNumber(task)
  if (isRefusal(id)) return id
  return write(
    database,
    (sqlite) => {
      const answerState = answerStateOf(loadTaskState(sqlite, id), id, session)
      if (answerState.kind === 'answered') {
        sqlite
          .prepare(
            "UPDATE steps SET answer = NULL WHERE task_id = ? AND claimed_by = ? AND status = 'running'"
          )
          .run(id, session)
      }
      return answerState
    },
    { keepRevision: (answerState) => answerState.kind !== 'answered' }
  )
}
