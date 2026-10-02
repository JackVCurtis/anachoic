/**
 * The board's entities, as 03 describes them. Instants are ISO 8601 UTC
 * strings, and no domain function reads the clock: every transition takes
 * `now` as an argument.
 */

export type Instant = string

export type TaskStatus = 'backlog' | 'queue' | 'active' | 'done'
export type StepStatus = 'pending' | 'running' | 'waiting' | 'done'
export type Owner = 'agent' | 'you'
export type StepOrigin = 'chain' | 'follow_up'
export type SessionKind = 'dedicated' | 'worker'

export const TASK_STATUSES: readonly TaskStatus[] = ['backlog', 'queue', 'active', 'done']
export const STEP_STATUSES: readonly StepStatus[] = ['pending', 'running', 'waiting', 'done']
export const OWNERS: readonly Owner[] = ['agent', 'you']
export const STEP_ORIGINS: readonly StepOrigin[] = ['chain', 'follow_up']
export const SESSION_KINDS: readonly SessionKind[] = ['dedicated', 'worker']

export const EVENT_KINDS = [
  'added',
  'queued',
  'reordered',
  'claimed',
  'started',
  'noted',
  'asked',
  'answered',
  'completed',
  'parked',
  'released',
  'signed_off',
  'followed_up',
  'archived',
] as const

export type EventKind = (typeof EVENT_KINDS)[number]

export const YOU = 'you'
export const DEDICATED_SESSION_ID = 'dedicated'

export type SessionId = string

/**
 * Who acts: you, or a session by its id. No session's id is 'you', which
 * identity resolution guarantees.
 */
export type Actor = typeof YOU | SessionId

export function isYou(actor: Actor): actor is typeof YOU {
  return actor === YOU
}

export interface Link {
  label: string
  url: string
}

export interface Task {
  id: number
  title: string
  status: TaskStatus
  queuePosition: number | null
  createdBy: Actor
  createdAt: Instant
  finishedAt: Instant | null
  signedOffAt: Instant | null
  archivedAt: Instant | null
}

export interface Step {
  id: string
  taskId: number
  number: number
  owner: Owner
  title: string
  detail: string | null
  status: StepStatus
  origin: StepOrigin
  claimedBy: SessionId | null
  question: string | null
  answer: string | null
  note: string | null
  summary: string | null
  links: Link[]
  startedAt: Instant | null
  runningSince: Instant | null
  waitingSince: Instant | null
  finishedAt: Instant | null
  elapsedSeconds: number
  waitedSeconds: number
}

export interface Session {
  id: SessionId
  kind: SessionKind
  name: string
  projectDir: string | null
  pid: number
  firstSeenAt: Instant
  lastSeenAt: Instant
  endedAt: Instant | null
}

export interface Event {
  taskId: number
  stepId: string | null
  sessionId: Actor
  kind: EventKind
  detail: string
  at: Instant
}

/**
 * One task and its chain, ordered by step number.
 */
export interface TaskState {
  task: Task
  steps: Step[]
}

/**
 * A step as a tool or the view asks for it.
 */
export interface StepInput {
  title: string
  owner: Owner
  detail?: string | null
}
