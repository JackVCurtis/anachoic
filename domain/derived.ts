import { currentStep } from './chain.js'
import { isRefusal } from './refusal.js'
import { isBlocked, preconditions, type Context } from './transitions.js'
import {
  YOU,
  type Instant,
  type OutputFormat,
  type Session,
  type Step,
  type Task,
  type TaskState,
} from './types.js'

/**
 * Facts the board shows that are computed from the rows and never stored.
 */

export type BoardList = 'yourTurn' | 'working' | 'queue' | 'backlog' | 'toSignOff' | 'signedOff'

/**
 * The list a task is in, or null when it is archived. Every task that is not
 * archived is in exactly one list.
 */
export function listOf({ task, steps }: TaskState): BoardList | null {
  if (task.archivedAt !== null) return null
  switch (task.status) {
    case 'active':
      return currentStep(steps).status === 'waiting' ? 'yourTurn' : 'working'
    case 'queue':
      return 'queue'
    case 'backlog':
      return 'backlog'
    case 'done':
      return task.signedOffAt === null ? 'toSignOff' : 'signedOff'
  }
}

/**
 * A session is dead when it has not been seen for longer than this.
 */
export const DEAD_WINDOW_MS = 2 * 60 * 1000

export function isLive(session: Session, now: Instant, deadWindowMs = DEAD_WINDOW_MS): boolean {
  return (
    session.endedAt === null && Date.parse(now) - Date.parse(session.lastSeenAt) <= deadWindowMs
  )
}

export interface ClaimedBy {
  id: string
  name: string
  live: boolean
}

/**
 * The session holding the task's current step, with its name and liveness,
 * or null when no session holds it.
 */
export function claimedBy(
  { steps }: TaskState,
  sessionOf: (id: string) => { name: string; live: boolean } | undefined
): ClaimedBy | null {
  const step = currentStep(steps)
  if (step.claimedBy === null) return null
  const session = sessionOf(step.claimedBy)
  return { id: step.claimedBy, name: session?.name ?? step.claimedBy, live: session?.live ?? false }
}

export interface CanAct {
  /** Mark your waiting step done */
  complete: boolean
  answer: boolean
  park: boolean
  reorder: boolean
  /** Move to the backlog: unqueue a queued task, park an active one */
  backlog: boolean
  queue: boolean
  archive: boolean
  signOff: boolean
  followUp: boolean
  /** Send the agent step whose output is in front of you back, with a note */
  reject: boolean
}

/**
 * For each action the views offer you, whether the domain would accept it now.
 */
export function canAct(state: TaskState): CanAct {
  const ctx: Context = { actor: YOU, now: state.task.createdAt }
  const accepts = (check: (state: TaskState, ctx: Context) => unknown) =>
    !isRefusal(check(state, ctx))
  return {
    complete: accepts(preconditions.completeMyStep),
    answer: accepts(preconditions.answer),
    park: accepts(preconditions.park),
    reorder: accepts(preconditions.reorder),
    backlog: accepts(preconditions.moveToBacklog),
    queue: accepts(preconditions.queue),
    archive: accepts(preconditions.archive),
    signOff: accepts(preconditions.signOff),
    followUp: accepts(preconditions.followUp),
    reject: accepts(preconditions.reject),
  }
}

/**
 * Time on the agent's steps: the closed intervals they spent running.
 */
export function agentSeconds(steps: readonly Step[]): number {
  return steps.reduce((sum, step) => sum + (step.owner === 'agent' ? step.elapsedSeconds : 0), 0)
}

/**
 * Your time: the closed intervals your steps waited on you, and the time the
 * agent's steps waited for your answers.
 */
export function yourSeconds(steps: readonly Step[]): number {
  return steps.reduce(
    (sum, step) => sum + (step.owner === 'you' ? step.elapsedSeconds : step.waitedSeconds),
    0
  )
}

export interface StepArtifact {
  stepNumber: number
  format: OutputFormat
  url: string
}

/**
 * The input a step takes: the artifact of the step before it, when that step
 * is done and produced one, or null.
 */
export function inputOf(steps: readonly Step[], step: Pick<Step, 'number'>): StepArtifact | null {
  const previous = steps.find((each) => each.number === step.number - 1)
  if (
    previous === undefined ||
    previous.status !== 'done' ||
    previous.outputFormat === null ||
    previous.artifactUrl === null
  ) {
    return null
  }
  return { stepNumber: previous.number, format: previous.outputFormat, url: previous.artifactUrl }
}

export function linkCount(steps: readonly Step[]): number {
  return steps.reduce((sum, step) => sum + step.links.length, 0)
}

export interface Counts {
  yourTurn: number
  working: number
  queue: number
  toSignOff: number
}

export function counts(states: readonly TaskState[]): Counts {
  const result: Counts = { yourTurn: 0, working: 0, queue: 0, toSignOff: 0 }
  for (const state of states) {
    const list = listOf(state)
    if (list === 'yourTurn' || list === 'working' || list === 'queue' || list === 'toSignOff') {
      result[list] += 1
    }
  }
  return result
}

export interface Holding {
  task: Task
  step: Step
  /** Waiting on your answer, or blocked until you act with the session. */
  status: 'running' | 'waiting' | 'blocked'
}

/**
 * The steps a session holds, by task number. A session is asked to hold one
 * at a time, but may hold several.
 */
export function holdings(sessionId: string, states: readonly TaskState[]): Holding[] {
  const held: Holding[] = []
  for (const { task, steps } of [...states].sort((a, b) => a.task.id - b.task.id)) {
    if (task.archivedAt !== null) continue
    const step = currentStep(steps)
    if (step.claimedBy === sessionId && (step.status === 'running' || step.status === 'waiting')) {
      held.push({ task, step, status: isBlocked(step) ? 'blocked' : step.status })
    }
  }
  return held
}

export interface SessionActivity {
  session: Session
  holding: Holding | null
}

/**
 * Each live session with the step it holds, if any.
 */
export function sessionActivity(
  sessions: readonly Session[],
  states: readonly TaskState[],
  now: Instant,
  deadWindowMs = DEAD_WINDOW_MS
): SessionActivity[] {
  return sessions
    .filter((session) => isLive(session, now, deadWindowMs))
    .map((session) => ({ session, holding: holdings(session.id, states)[0] ?? null }))
}
