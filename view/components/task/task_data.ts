import type { TaskList } from '../helpers/task_view'
import type { OutputFormat, Owner, StepStatus } from '../types'

/**
 * The shapes the task view is given, in its own terms. The entries map the
 * server's task props to them.
 */

/** A live worker session, such as the one a task is assigned to. */
export interface TaskWorker {
  id: string
  name: string
}

/** A link a session recorded on a step with update_step or complete_step. */
export interface TaskLink {
  label: string
  url: string
}

/** A link to what a done agent step with an output format produced. */
export interface TaskArtifact {
  /** From 1. */
  stepNumber: number
  format: OutputFormat
  url: string
}

/** Why a worker blocked its step, and since when. */
export interface TaskBlock {
  reason: string
  /** An instant. */
  since: string
}

/**
 * One step of the chain, with everything the app records about it.
 */
export interface TimelineStepData {
  id: string
  /** From 1. A step's number never changes. */
  number: number
  owner: Owner
  title: string
  status: StepStatus
  detail?: string | null
  /** The session that claimed the step. Absent before one does. */
  sessionName?: string | null
  /** An agent's question, which the step waits on until it is answered. */
  question?: string | null
  answer?: string | null
  /** Set while the worker has blocked the step. It is unblocked in the worker's session. */
  blocked?: TaskBlock | null
  /** The latest progress note. */
  note?: string | null
  summary?: string | null
  links?: readonly TaskLink[]
  /** Agent steps only: what the step hands on when it is done. */
  outputFormat?: OutputFormat | null
  /** Set once a step with an output format is done. */
  artifactUrl?: string | null
  /** A user step's input: what the step before it produced. */
  input?: TaskArtifact | null
  /** How long a done step took, in seconds. */
  durationSeconds?: number | null
  /** An instant: when a running step last started running. */
  runningSince?: string | null
  /** Seconds a running step spent on its earlier attempts. */
  elapsedSeconds?: number | null
  /** An instant: when a waiting step last began to wait. */
  waitingSince?: string | null
}

export const TASK_EVENT_KINDS = [
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
  'assigned',
  'unassigned',
  'blocked',
  'unblocked',
  'removed',
] as const

export type TaskEventKind = (typeof TASK_EVENT_KINDS)[number]

/** Something that happened to the task. */
export interface TaskEventData {
  /** Unique within the task. */
  id: string
  /** An instant. */
  at: string
  kind: TaskEventKind
  /** The step the event names, if any. */
  stepNumber?: number | null
  /** The session that caused it. Null when the user did. */
  sessionName: string | null
  detail?: string | null
}

/** What the task view's header shows of a task, which a board card already knows. */
export interface TaskSummary {
  id: string
  /** Such as "T-012". */
  displayId: string
  title: string
  /** The worker that alone may take the task's agent steps. Absent or null when any may. */
  assignedTo?: TaskWorker | null
}

/**
 * One task in full.
 */
export interface TaskViewData {
  task: TaskSummary
  /** The list the task is in, for the badge. Null when it is in none. */
  list: TaskList | null
  /** In chain order. */
  steps: readonly TimelineStepData[]
  /** The step the chain is at. Null when the task is done. */
  currentStepId: string | null
  /** Oldest first. */
  events: readonly TaskEventData[]
  agentSeconds: number
  yourSeconds: number
  /** The actions on the task as a whole that the server allows. */
  canAct: { park: boolean; archive: boolean }
}
