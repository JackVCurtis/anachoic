import {
  checkResponses,
  firstQuestion,
  renderAnswer,
  renderDirectAnswer,
  type FormResponse,
} from '../shared/form.js'
import { isWebAddress } from '../shared/output_format.js'
import { stepId } from '../shared/step_id.js'
import { formatTaskId } from '../shared/task_id.js'
import { currentStepIndex } from './chain.js'
import type { Placement } from './queue_order.js'
import {
  agentStep,
  archived,
  blocked,
  assignedToAnother,
  claimedByAnother,
  invalid,
  isRefusal,
  needsArtifact,
  notAWebAddress,
  notBlocked,
  notRunning,
  nothingToReject,
  onlyASession,
  onlyYou,
  signedOff,
  unanswered,
  wrongStatus,
  wrongStepStatus,
  yourStep,
  type Refusal,
} from './refusal.js'
import {
  isYou,
  type Actor,
  type Event,
  type EventKind,
  type Form,
  type Instant,
  type Link,
  type SessionId,
  type Step,
  type StepInput,
  type Task,
  type TaskState,
} from './types.js'

/**
 * How a transition changes the queue. The store applies it with the queue
 * order functions, which renumber every position.
 */
export type QueueEffect =
  | { kind: 'none' }
  | { kind: 'join'; placement: Placement }
  | { kind: 'move'; position: number }
  | { kind: 'leave' }

export type { Placement }

/**
 * What a transition did: the task and its whole chain as they now are, the
 * queue effect, and the events to append, in order.
 */
export interface Change {
  task: Task
  steps: Step[]
  queue: QueueEffect
  events: Event[]
}

export type Outcome = Change | Refusal

export interface Context {
  actor: Actor
  now: Instant
  /**
   * A session's display name, for the sentences of refusals and events.
   */
  nameOf?: (sessionId: SessionId) => string | undefined
}

const NONE: QueueEffect = { kind: 'none' }
const LEAVE: QueueEffect = { kind: 'leave' }
const JOIN_FIRST: QueueEffect = { kind: 'join', placement: 'first' }
const JOIN_LAST: QueueEffect = { kind: 'join', placement: 'last' }

const BRIEF = 120

function brief(text: string) {
  return text.length <= BRIEF ? text : `${text.slice(0, BRIEF - 1)}…`
}

function nameOf(ctx: Context, sessionId: SessionId) {
  return ctx.nameOf?.(sessionId) ?? sessionId
}

function event(
  ctx: Context,
  taskId: number,
  step: Step | null,
  kind: EventKind,
  detail: string,
  sessionId: Actor = ctx.actor
): Event {
  return { taskId, stepId: step?.id ?? null, sessionId, kind, detail, at: ctx.now }
}

function secondsBetween(since: Instant, now: Instant) {
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(since)) / 1000))
}

/**
 * Closes the step's open interval. Running time is an agent's work; waiting
 * time is yours, counted as the step's elapsed time on your step and as its
 * waited time on an agent's.
 */
function closeInterval(step: Step, now: Instant): Step {
  if (step.status === 'running' && step.runningSince !== null) {
    return {
      ...step,
      elapsedSeconds: step.elapsedSeconds + secondsBetween(step.runningSince, now),
      runningSince: null,
    }
  }
  if (step.status === 'waiting' && step.waitingSince !== null) {
    const waited = secondsBetween(step.waitingSince, now)
    return step.owner === 'you'
      ? { ...step, elapsedSeconds: step.elapsedSeconds + waited, waitingSince: null }
      : { ...step, waitedSeconds: step.waitedSeconds + waited, waitingSince: null }
  }
  return step
}

function backToPending(step: Step, now: Instant): Step {
  return {
    ...closeInterval(step, now),
    status: 'pending',
    claimedBy: null,
    form: null,
    answer: null,
    blockedReason: null,
    blockedAt: null,
  }
}

/**
 * A blocked step waits on you without a form.
 */
export function isBlocked(step: Step): boolean {
  return step.blockedReason !== null
}

function withStep(steps: readonly Step[], index: number, step: Step): Step[] {
  return steps.map((each, at) => (at === index ? step : each))
}

function current(state: TaskState) {
  const index = currentStepIndex(state.steps)
  return { index, step: state.steps[index] }
}

function newSteps(
  taskId: number,
  from: number,
  inputs: readonly StepInput[],
  origin: Step['origin']
) {
  return inputs.map((input, offset): Step => ({
    id: stepId(taskId, from + offset),
    taskId,
    number: from + offset,
    owner: input.owner,
    title: input.title,
    detail: input.detail ?? null,
    status: 'pending',
    origin,
    claimedBy: null,
    form: null,
    answer: null,
    note: null,
    summary: null,
    links: [],
    outputFormat: input.outputFormat ?? null,
    artifactUrl: null,
    blockedReason: null,
    blockedAt: null,
    rejection: null,
    startedAt: null,
    runningSince: null,
    waitingSince: null,
    finishedAt: null,
    elapsedSeconds: 0,
    waitedSeconds: 0,
  }))
}

function mergeLinks(existing: readonly Link[], added: readonly Link[] | undefined): Link[] {
  const merged = [...existing]
  for (const link of added ?? []) {
    if (!merged.some((each) => each.url === link.url)) merged.push(link)
  }
  return merged
}

/**
 * The index of the agent step whose output is in front of you: the done
 * agent step just before your waiting step on an active task, or the last
 * step of a done task when it is an agent's. Null when there is none.
 */
export function rejectable({ task, steps }: TaskState): number | null {
  const index = currentStepIndex(steps)
  const step = steps[index]
  if (task.status === 'done') {
    return step.owner === 'agent' && step.status === 'done' ? index : null
  }
  if (task.status !== 'active' || step.owner !== 'you' || step.status !== 'waiting') return null
  const previous = steps[index - 1]
  return previous?.owner === 'agent' && previous.status === 'done' ? index - 1 : null
}

// Preconditions. Each returns the refusal a transition would give, or null.
// canAct uses them, so the view offers exactly what the domain accepts.

function notArchived(state: TaskState): Refusal | null {
  return state.task.archivedAt === null ? null : archived(state.task.id)
}

/**
 * `action` names what only you can do, with {task} for the task's display id.
 */
function byYou(state: TaskState, ctx: Context, action: string): Refusal | null {
  return isYou(ctx.actor) ? null : onlyYou(state.task.id, action)
}

function inStatus(state: TaskState, ...statuses: Task['status'][]): Refusal | null {
  return statuses.includes(state.task.status)
    ? null
    : wrongStatus(state.task.id, state.task.status, statuses)
}

function first(...checks: Array<() => Refusal | null>): Refusal | null {
  for (const check of checks) {
    const found = check()
    if (found) return found
  }
  return null
}

export const preconditions = {
  queue: (state: TaskState, _ctx: Context) =>
    first(
      () => notArchived(state),
      () => inStatus(state, 'backlog')
    ),
  unqueue: (state: TaskState, ctx: Context) =>
    first(
      () => notArchived(state),
      () => byYou(state, ctx, 'move {task} to the backlog'),
      () => inStatus(state, 'queue')
    ),
  reorder: (state: TaskState, ctx: Context) =>
    first(
      () => notArchived(state),
      () => byYou(state, ctx, 'reorder {task}'),
      () => inStatus(state, 'queue')
    ),
  claim: (state: TaskState, ctx: Context) =>
    first(
      () => notArchived(state),
      () => (isYou(ctx.actor) ? onlyASession(state.task.id, 'claim a step of {task}') : null),
      () => {
        const { assignedTo } = state.task
        return assignedTo === null || assignedTo === ctx.actor
          ? null
          : assignedToAnother(state.task.id, nameOf(ctx, assignedTo))
      },
      () => inStatus(state, 'queue'),
      () => {
        const { step } = current(state)
        return step.owner === 'agent' && step.status === 'pending'
          ? null
          : wrongStepStatus(
              state.task.id,
              step.number,
              'is not an agent step waiting to be claimed'
            )
      }
    ),
  start: (state: TaskState, _ctx: Context) =>
    first(
      () => notArchived(state),
      () => inStatus(state, 'backlog', 'queue'),
      () => {
        const { step } = current(state)
        return step.owner === 'you' ? null : agentStep(state.task.id, step.number)
      }
    ),
  /**
   * The worker tools act only on the current step, claimed by the caller.
   */
  held: (state: TaskState, ctx: Context) =>
    first(
      () => notArchived(state),
      () => {
        const { task } = state
        if (task.status === 'active') return null
        const addendum =
          task.status === 'backlog'
            ? 'It was parked. Stop work on it.'
            : task.status === 'queue'
              ? 'Your claim on it has ended. Call claim_step to take it again.'
              : 'Every step is done.'
        return wrongStatus(task.id, task.status, ['active'], addendum)
      },
      () => {
        const { step } = current(state)
        if (step.owner === 'you') return yourStep(state.task.id, step.number)
        if (step.claimedBy !== ctx.actor) {
          return claimedByAnother(state.task.id, step.number, nameOf(ctx, step.claimedBy ?? ''))
        }
        return null
      }
    ),
  /**
   * The worker tools other than unblock_step refuse a blocked step.
   */
  heldUnblocked: (state: TaskState, ctx: Context) =>
    first(
      () => preconditions.held(state, ctx),
      () => {
        const { step } = current(state)
        return isBlocked(step) ? blocked(state.task.id, step.number) : null
      }
    ),
  ask: (state: TaskState, ctx: Context) =>
    first(
      () => preconditions.heldUnblocked(state, ctx),
      () => {
        const { step } = current(state)
        return step.status === 'running' ? null : unanswered(state.task.id, step.number)
      }
    ),
  completeStep: (state: TaskState, ctx: Context) =>
    first(
      () => preconditions.heldUnblocked(state, ctx),
      () => {
        const { step } = current(state)
        return step.status === 'running' ? null : unanswered(state.task.id, step.number)
      }
    ),
  block: (state: TaskState, ctx: Context) =>
    first(
      () => preconditions.held(state, ctx),
      () => {
        const { step } = current(state)
        return step.status === 'running' ? null : notRunning(state.task.id, step.number)
      }
    ),
  unblock: (state: TaskState, ctx: Context) =>
    first(
      () => preconditions.held(state, ctx),
      () => {
        const { step } = current(state)
        return isBlocked(step) ? null : notBlocked(state.task.id, step.number)
      }
    ),
  answer: (state: TaskState, ctx: Context) =>
    first(
      () => notArchived(state),
      () => byYou(state, ctx, 'answer the question on {task}'),
      () => inStatus(state, 'active'),
      () => {
        const { step } = current(state)
        if (step.owner === 'you') {
          return wrongStepStatus(state.task.id, step.number, "is the user's step, not a question")
        }
        return step.status === 'waiting' && !isBlocked(step)
          ? null
          : wrongStepStatus(state.task.id, step.number, 'is not waiting for an answer')
      }
    ),
  completeMyStep: (state: TaskState, ctx: Context) =>
    first(
      () => notArchived(state),
      () => byYou(state, ctx, "mark the user's step on {task} done"),
      () => inStatus(state, 'active'),
      () => {
        const { step } = current(state)
        return step.owner === 'you' ? null : agentStep(state.task.id, step.number)
      }
    ),
  park: (state: TaskState, ctx: Context) =>
    first(
      () => notArchived(state),
      () => byYou(state, ctx, 'park {task}'),
      () => inStatus(state, 'active')
    ),
  moveToBacklog: (state: TaskState, ctx: Context) =>
    first(
      () => notArchived(state),
      () => byYou(state, ctx, 'move {task} to the backlog'),
      () => inStatus(state, 'queue', 'active')
    ),
  release: (state: TaskState, ctx: Context) =>
    first(
      () => notArchived(state),
      () => inStatus(state, 'active'),
      () => {
        const { step } = current(state)
        return step.owner === 'agent' && step.claimedBy === ctx.actor
          ? null
          : wrongStepStatus(
              state.task.id,
              step.number,
              `is not claimed by ${nameOf(ctx, ctx.actor)}`
            )
      }
    ),
  signOff: (state: TaskState, ctx: Context) =>
    first(
      () => notArchived(state),
      () => byYou(state, ctx, 'sign off {task}'),
      () => (state.task.signedOffAt === null ? null : signedOff(state.task.id)),
      () => inStatus(state, 'done')
    ),
  followUp: (state: TaskState, _ctx: Context) =>
    first(
      () => notArchived(state),
      () => (state.task.signedOffAt === null ? null : signedOff(state.task.id)),
      () => inStatus(state, 'done')
    ),
  reject: (state: TaskState, ctx: Context) =>
    first(
      () => notArchived(state),
      () => byYou(state, ctx, 'reject a step of {task}'),
      () => (state.task.signedOffAt === null ? null : signedOff(state.task.id)),
      () => (rejectable(state) === null ? nothingToReject(state.task.id) : null)
    ),
  archive: (state: TaskState, ctx: Context) =>
    first(
      () => notArchived(state),
      () => byYou(state, ctx, 'archive {task}'),
      () => (state.task.signedOffAt === null ? null : signedOff(state.task.id))
    ),
}

/**
 * The task's current step is yours, so it starts at once: the task becomes
 * active and the step waits on you. It never passes through the queue.
 */
function startNow(state: TaskState, ctx: Context): Change {
  const { index, step } = current(state)
  const started: Step = {
    ...step,
    status: 'waiting',
    waitingSince: ctx.now,
    startedAt: step.startedAt ?? ctx.now,
  }
  return {
    task: { ...state.task, status: 'active' },
    steps: withStep(state.steps, index, started),
    queue: state.task.status === 'queue' ? LEAVE : NONE,
    events: [
      event(ctx, state.task.id, started, 'started', `Step ${started.number} waits on the user`),
    ],
  }
}

/**
 * Sends a task whose current step is pending to the queue, or starts it at
 * once when that step is yours.
 */
function queueOrStart(state: TaskState, ctx: Context, placement: Placement): Change {
  if (current(state).step.owner === 'you') {
    return startNow(state, ctx)
  }
  return {
    task: { ...state.task, status: 'queue' },
    steps: state.steps,
    queue: placement === 'first' ? JOIN_FIRST : JOIN_LAST,
    events: [
      event(
        ctx,
        state.task.id,
        null,
        'queued',
        placement === 'first' ? 'Joined the front of the queue' : 'Joined the back of the queue'
      ),
    ],
  }
}

function withEvents(change: Change, ...before: Event[]): Change {
  return { ...change, events: [...before, ...change.events] }
}

export interface NewTask {
  taskId: number
  title: string
  steps: readonly StepInput[]
  /**
   * The worker the task is assigned to. The caller has checked that it is a
   * live worker, which needs the sessions this module cannot see.
   */
  assignTo?: SessionId | null
}

/**
 * Add: a new task in the backlog, every step pending, assigned to the worker
 * given.
 */
export function add(input: NewTask, ctx: Context): Change {
  const task: Task = {
    id: input.taskId,
    title: input.title,
    status: 'backlog',
    queuePosition: null,
    createdBy: ctx.actor,
    createdAt: ctx.now,
    finishedAt: null,
    signedOffAt: null,
    archivedAt: null,
    assignedTo: input.assignTo ?? null,
    resumeWith: null,
  }
  const steps = newSteps(input.taskId, 1, input.steps, 'chain')
  const count = steps.length === 1 ? '1 step' : `${steps.length} steps`
  const events = [event(ctx, task.id, null, 'added', `Added with ${count}`)]
  if (task.assignedTo !== null) {
    events.push(
      event(ctx, task.id, null, 'assigned', `Assigned to ${nameOf(ctx, task.assignedTo)}`)
    )
  }
  return { task, steps, queue: NONE, events }
}

/**
 * Add to queue: a new task at the back of the queue, or active at once when
 * its first step is yours.
 */
export function addToQueue(input: NewTask, ctx: Context): Change {
  const added = add(input, ctx)
  return withEvents(queueOrStart(added, ctx, 'last'), ...added.events)
}

/**
 * Queue: a backlog task joins the back of the queue, or starts at once when
 * its current step is yours. Given a worker, or null for none, the task is
 * assigned afresh as it goes; the caller has checked that the worker is live.
 */
export function queue(state: TaskState, ctx: Context, assignTo?: SessionId | null): Outcome {
  const refused = preconditions.queue(state, ctx)
  if (refused) return refused
  if (assignTo === undefined || assignTo === state.task.assignedTo) {
    return queueOrStart(state, ctx, 'last')
  }
  const reassigned = { ...state, task: { ...state.task, assignedTo: assignTo } }
  const assignment =
    assignTo === null
      ? event(ctx, state.task.id, null, 'unassigned', 'Unassigned: any worker may take it')
      : event(ctx, state.task.id, null, 'assigned', `Assigned to ${nameOf(ctx, assignTo)}`)
  return withEvents(queueOrStart(reassigned, ctx, 'last'), assignment)
}

/**
 * Unqueue: a queued task goes back to the backlog, and the queue closes up.
 */
export function unqueue(state: TaskState, ctx: Context): Outcome {
  const refused = preconditions.unqueue(state, ctx)
  if (refused) return refused
  return {
    task: { ...state.task, status: 'backlog', resumeWith: null },
    steps: state.steps,
    queue: LEAVE,
    events: [event(ctx, state.task.id, null, 'parked', 'Moved from the queue to the backlog')],
  }
}

/**
 * Reorder: a queued task takes the position it was dropped at. A position
 * beyond the end means the last place.
 */
export function reorder(state: TaskState, ctx: Context, position: number): Outcome {
  const refused = preconditions.reorder(state, ctx)
  if (refused) return refused
  if (!Number.isSafeInteger(position) || position < 1) {
    return invalid('position must be a whole number from 1')
  }
  return {
    task: state.task,
    steps: state.steps,
    queue: { kind: 'move', position },
    events: [event(ctx, state.task.id, null, 'reordered', `Moved to position ${position}`)],
  }
}

/**
 * Claim: the calling session takes the queued task's current agent step.
 */
export function claim(state: TaskState, ctx: Context): Outcome {
  const refused = preconditions.claim(state, ctx)
  if (refused) return refused
  const { index, step } = current(state)
  const claimed: Step = {
    ...step,
    status: 'running',
    claimedBy: ctx.actor,
    runningSince: ctx.now,
    startedAt: step.startedAt ?? ctx.now,
  }
  return {
    task: { ...state.task, status: 'active', resumeWith: null },
    steps: withStep(state.steps, index, claimed),
    queue: LEAVE,
    events: [event(ctx, state.task.id, claimed, 'claimed', `Claimed by ${nameOf(ctx, ctx.actor)}`)],
  }
}

/**
 * Start, for your step: automatic, when your step becomes current on a task
 * in the backlog or the queue.
 */
export function start(state: TaskState, ctx: Context): Outcome {
  return preconditions.start(state, ctx) ?? startNow(state, ctx)
}

export interface NoteInput {
  note: string
  links?: readonly Link[]
}

/**
 * update_step: the claiming session records a progress note on its step.
 */
export function note(state: TaskState, ctx: Context, input: NoteInput): Outcome {
  const refused = preconditions.heldUnblocked(state, ctx)
  if (refused) return refused
  const { index, step } = current(state)
  const noted: Step = { ...step, note: input.note, links: mergeLinks(step.links, input.links) }
  return {
    task: state.task,
    steps: withStep(state.steps, index, noted),
    queue: NONE,
    events: [event(ctx, state.task.id, noted, 'noted', brief(input.note))],
  }
}

/**
 * ask_you: the claiming session's running step waits on you with a form.
 * A new form replaces any answer not yet collected.
 */
export function ask(state: TaskState, ctx: Context, form: Form): Outcome {
  const refused = preconditions.ask(state, ctx)
  if (refused) return refused
  const { index, step } = current(state)
  const asked: Step = {
    ...closeInterval(step, ctx.now),
    status: 'waiting',
    waitingSince: ctx.now,
    form,
    answer: null,
  }
  return {
    task: state.task,
    steps: withStep(state.steps, index, asked),
    queue: NONE,
    events: [event(ctx, state.task.id, asked, 'asked', brief(firstQuestion(form)))],
  }
}

/**
 * How the user answers a form: with responses that walk it to an end, or
 * directly in their own words instead.
 */
export type AnswerInput = { responses: readonly FormResponse[] } | { direct: string }

/**
 * You answer an agent's form: the step runs again with the answer, as
 * markdown, stored until the agent collects it.
 */
export function answer(state: TaskState, ctx: Context, input: AnswerInput): Outcome {
  const refused = preconditions.answer(state, ctx)
  if (refused) return refused
  const { index, step } = current(state)
  let text: string
  if ('direct' in input) {
    text = renderDirectAnswer(input.direct)
  } else {
    // A waiting, unblocked agent step always has a form (invariant 7).
    const form = step.form as Form
    const problem = checkResponses(form, input.responses)
    if (problem) return invalid(problem)
    text = renderAnswer(form, input.responses)
  }
  const answered: Step = {
    ...closeInterval(step, ctx.now),
    status: 'running',
    runningSince: ctx.now,
    form: null,
    answer: text,
  }
  return {
    task: state.task,
    steps: withStep(state.steps, index, answered),
    queue: NONE,
    events: [event(ctx, state.task.id, answered, 'answered', brief(text))],
  }
}

/**
 * block_step: the claiming session cannot go on without you acting with it
 * in its own session. Its running step waits on you, with the reason.
 */
export function block(state: TaskState, ctx: Context, reason: string): Outcome {
  const refused = preconditions.block(state, ctx)
  if (refused) return refused
  const { index, step } = current(state)
  const blockedStep: Step = {
    ...closeInterval(step, ctx.now),
    status: 'waiting',
    waitingSince: ctx.now,
    blockedReason: reason,
    blockedAt: ctx.now,
  }
  return {
    task: state.task,
    steps: withStep(state.steps, index, blockedStep),
    queue: NONE,
    events: [event(ctx, state.task.id, blockedStep, 'blocked', brief(reason))],
  }
}

/**
 * unblock_step: the claiming session's blocked step runs again. The time it
 * spent blocked counts as time waited on you, as for a question.
 */
export function unblock(state: TaskState, ctx: Context, withNote?: string | null): Outcome {
  const refused = preconditions.unblock(state, ctx)
  if (refused) return refused
  const { index, step } = current(state)
  const unblocked: Step = {
    ...closeInterval(step, ctx.now),
    status: 'running',
    runningSince: ctx.now,
    blockedReason: null,
    blockedAt: null,
  }
  return {
    task: state.task,
    steps: withStep(state.steps, index, unblocked),
    queue: NONE,
    events: [
      event(ctx, state.task.id, unblocked, 'unblocked', withNote ? brief(withNote) : 'Unblocked'),
    ],
  }
}

/**
 * The chain moves on after its current step is done: the task is done when
 * there is no next step, goes to the front of the queue when the next step is
 * an agent's, and stays active with your next step waiting on you.
 */
function advance(state: TaskState, ctx: Context, completed: Event): Change {
  const { step } = current(state)
  if (step.status === 'done') {
    return {
      task: { ...state.task, status: 'done', finishedAt: ctx.now, resumeWith: null },
      steps: state.steps,
      queue: NONE,
      events: [completed],
    }
  }
  if (step.owner === 'agent') {
    return withEvents(queueOrStart(state, ctx, 'first'), completed)
  }
  return withEvents(
    startNow({ ...state, task: { ...state.task, status: 'backlog' } }, ctx),
    completed
  )
}

export interface CompleteInput {
  summary: string
  links?: readonly Link[]
  /** Required when the step has an output format, and ignored when it has none. */
  artifactUrl?: string | null
}

/**
 * complete_step: the claiming session finishes its running step.
 */
export function completeStep(state: TaskState, ctx: Context, input: CompleteInput): Outcome {
  const refused = preconditions.completeStep(state, ctx)
  if (refused) return refused
  const { index, step } = current(state)
  const artifactUrl = artifactOf(state, step, input.artifactUrl)
  if (isRefusal(artifactUrl)) return artifactUrl
  const done: Step = {
    ...closeInterval(step, ctx.now),
    status: 'done',
    claimedBy: null,
    summary: input.summary,
    links: mergeLinks(step.links, input.links),
    artifactUrl,
    rejection: null,
    finishedAt: ctx.now,
  }
  const steps = withStep(state.steps, index, done)
  const next = steps[index + 1]
  // The worker that hands a step to you gets the task back when you are done.
  const resumeWith = next?.owner === 'you' ? ctx.actor : null
  return advance(
    { task: { ...state.task, resumeWith }, steps },
    ctx,
    event(ctx, state.task.id, done, 'completed', brief(input.summary))
  )
}

export interface CompleteMyStepInput {
  note?: string | null
}

/**
 * The artifact URL an agent step stores when it is completed, or the refusal.
 */
function artifactOf(state: TaskState, step: Step, given: string | null | undefined) {
  if (step.outputFormat === null) return null
  const url = given?.trim() ?? ''
  if (url === '') return needsArtifact(state.task.id, step.number, step.outputFormat)
  return isWebAddress(url) ? url : notAWebAddress()
}

/**
 * You mark your waiting step done, with an optional note. A format that a
 * step of yours carries from before formats moved to agent steps is never
 * required.
 */
export function completeMyStep(
  state: TaskState,
  ctx: Context,
  input: CompleteMyStepInput = {}
): Outcome {
  const refused = preconditions.completeMyStep(state, ctx)
  if (refused) return refused
  const { index, step } = current(state)
  const done: Step = {
    ...closeInterval(step, ctx.now),
    status: 'done',
    note: input.note ?? step.note,
    finishedAt: ctx.now,
  }
  return advance(
    { task: state.task, steps: withStep(state.steps, index, done) },
    ctx,
    event(ctx, state.task.id, done, 'completed', input.note ? brief(input.note) : 'Marked done')
  )
}

/**
 * Park: an active task goes to the backlog, and its current step returns to
 * pending with any claim, question and answer cleared.
 */
export function park(state: TaskState, ctx: Context): Outcome {
  const refused = preconditions.park(state, ctx)
  if (refused) return refused
  const { index, step } = current(state)
  const parked = backToPending(step, ctx.now)
  return {
    task: { ...state.task, status: 'backlog', resumeWith: null },
    steps: withStep(state.steps, index, parked),
    queue: NONE,
    events: [event(ctx, state.task.id, parked, 'parked', 'Parked in the backlog')],
  }
}

/**
 * move_to_backlog: parks an active task, and unqueues a queued one.
 */
export function moveToBacklog(state: TaskState, ctx: Context): Outcome {
  const refused = preconditions.moveToBacklog(state, ctx)
  if (refused) return refused
  return state.task.status === 'active' ? park(state, ctx) : unqueue(state, ctx)
}

/**
 * Why a session's claims and assignments end: it stopped responding, or it
 * was removed from the board.
 */
export type Departure = 'dead' | 'removed'

function departed(ctx: Context, why: Departure) {
  return `${nameOf(ctx, ctx.actor)} ${why === 'dead' ? 'stopped responding' : 'left the board'}`
}

/**
 * Release: automatic, when the session that claimed the current step is found
 * dead or is removed. `ctx.actor` is that session. The task goes to the front
 * of the queue.
 */
export function release(state: TaskState, ctx: Context, why: Departure = 'dead'): Outcome {
  const refused = preconditions.release(state, ctx)
  if (refused) return refused
  const { index, step } = current(state)
  const released = backToPending(step, ctx.now)
  return {
    task: { ...state.task, status: 'queue', resumeWith: null },
    steps: withStep(state.steps, index, released),
    queue: JOIN_FIRST,
    events: [event(ctx, state.task.id, released, 'released', `Released: ${departed(ctx, why)}`)],
  }
}

/**
 * Unassign: automatic, when the worker the task is assigned to is found dead
 * or is removed. `ctx.actor` is that worker. Nothing else about the task
 * changes.
 */
export function unassign(state: TaskState, ctx: Context, why: Departure = 'dead'): Outcome {
  if (state.task.assignedTo === null || state.task.assignedTo !== ctx.actor) {
    return invalid(`${formatTaskId(state.task.id)} is not assigned to ${nameOf(ctx, ctx.actor)}`)
  }
  return {
    task: { ...state.task, assignedTo: null },
    steps: state.steps,
    queue: NONE,
    events: [event(ctx, state.task.id, null, 'unassigned', `Unassigned: ${departed(ctx, why)}`)],
  }
}

/**
 * Sign off: you accept a done task.
 */
export function signOff(state: TaskState, ctx: Context): Outcome {
  const refused = preconditions.signOff(state, ctx)
  if (refused) return refused
  return {
    task: { ...state.task, signedOffAt: ctx.now },
    steps: state.steps,
    queue: NONE,
    events: [event(ctx, state.task.id, null, 'signed_off', 'Signed off')],
  }
}

export interface FollowUpInput {
  steps: readonly StepInput[]
  placement: Placement
}

/**
 * Follow-up: new steps are appended to a done task, which goes back to the
 * queue where asked, or starts at once when the first new step is yours.
 */
export function followUp(state: TaskState, ctx: Context, input: FollowUpInput): Outcome {
  const refused = preconditions.followUp(state, ctx)
  if (refused) return refused
  const added = newSteps(state.task.id, state.steps.length + 1, input.steps, 'follow_up')
  const extended: TaskState = {
    task: { ...state.task, status: 'backlog', finishedAt: null },
    steps: [...state.steps, ...added],
  }
  const count = added.length === 1 ? '1 new step' : `${added.length} new steps`
  return withEvents(
    queueOrStart(extended, ctx, input.placement),
    event(ctx, state.task.id, null, 'followed_up', `Followed up with ${count}`)
  )
}

export interface RejectInput {
  note: string
  /**
   * The session that completed the rejected step, if it has not ended,
   * which needs the events and sessions this module cannot see.
   */
  resumeWith: SessionId | null
}

/**
 * Reject: you send the agent step whose output is in front of you back to
 * pending, with a note. Your waiting step after it, if any, returns to
 * pending, and the task goes to the front of the queue, preferring the
 * worker that did the step. The step keeps its summary, links and time.
 */
export function reject(state: TaskState, ctx: Context, input: RejectInput): Outcome {
  const refused = preconditions.reject(state, ctx)
  if (refused) return refused
  const index = rejectable(state)!
  const target = state.steps[index]
  const reopened: Step = {
    ...target,
    status: 'pending',
    artifactUrl: null,
    finishedAt: null,
    rejection: input.note,
  }
  let steps = withStep(state.steps, index, reopened)
  const yours = steps[index + 1]
  if (yours?.status === 'waiting') steps = withStep(steps, index + 1, backToPending(yours, ctx.now))
  return withEvents(
    queueOrStart(
      {
        task: { ...state.task, status: 'backlog', finishedAt: null, resumeWith: input.resumeWith },
        steps,
      },
      ctx,
      'first'
    ),
    event(ctx, state.task.id, reopened, 'rejected', brief(input.note))
  )
}

/**
 * Archive: the task leaves every list with its status unchanged. Its queue
 * position, assignment, resumeWith, any claim and any unanswered question are
 * cleared.
 */
export function archive(state: TaskState, ctx: Context): Outcome {
  const refused = preconditions.archive(state, ctx)
  if (refused) return refused
  const { index, step } = current(state)
  const held = step.status === 'running' || step.status === 'waiting'
  return {
    task: { ...state.task, archivedAt: ctx.now, assignedTo: null, resumeWith: null },
    steps: held ? withStep(state.steps, index, backToPending(step, ctx.now)) : state.steps,
    queue: state.task.status === 'queue' ? LEAVE : NONE,
    events: [event(ctx, state.task.id, null, 'archived', 'Archived')],
  }
}
