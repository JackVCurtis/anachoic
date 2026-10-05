import type { OutputFormat, Owner, StepStatus } from '../types'

/**
 * The shapes the board view is given, in the board's own terms. The entry
 * maps the server's board props to them.
 */

/**
 * A live worker session: one a task is assigned to, or one you can assign to.
 */
export interface BoardWorker {
  id: string
  name: string
}

export interface BoardTask {
  id: string
  /** Such as "T-012". */
  displayId: string
  title: string
  /** The worker that alone may take the task's agent steps. Absent or null when any may. */
  assignedTo?: BoardWorker | null
}

/**
 * A link to what a done agent step produced.
 */
export interface BoardArtifact {
  /** From 1. */
  stepNumber: number
  format: OutputFormat
  url: string
}

/**
 * One step of a chain as a row of pips draws it.
 */
export interface BoardStep {
  id: string
  owner: Owner
  status: StepStatus
  title: string
  /** The session that claimed the step. Absent before one does. */
  sessionName?: string | null
}

export interface YourTurnTask {
  task: BoardTask
  step: {
    /** From 1. */
    number: number
    title: string
    owner: Owner
    /** An agent's question. Absent for a user step. */
    question?: string | null
    /** An instant. */
    waitingSince: string
  }
  /**
   * For a user step, what the step before it produced, which the card links
   * to. Absent or null when it produced nothing.
   */
  input?: BoardArtifact | null
  /** The session that asks, or the worker that blocked the step. Absent for a user step. */
  sessionName?: string | null
  /**
   * Set when the worker blocked its step: why, and since when. It is
   * unblocked in the worker's session, so the card offers no action.
   */
  blocked?: BoardBlock | null
  steps: readonly BoardStep[]
  /** `reject`: the agent step before a user step can be sent back. */
  canAct: { complete?: boolean; answer?: boolean; park: boolean; reject?: boolean }
}

export interface BoardBlock {
  reason: string
  /** An instant. */
  since: string
}

export interface WorkingTask {
  task: BoardTask
  step: {
    number: number
    title: string
    /** The session's latest progress note. */
    note?: string | null
    /** What the step must produce when it is completed. Absent or null when nothing. */
    outputFormat?: OutputFormat | null
    /** An instant. */
    runningSince: string
  }
  sessionName: string
  steps: readonly BoardStep[]
  /** The links from its done steps. */
  artifacts?: readonly BoardArtifact[]
}

export interface QueueTask {
  task: BoardTask
  /** From 1. */
  position: number
  nextOwner: Owner
  steps: readonly BoardStep[]
  /** The links from its done steps. */
  artifacts?: readonly BoardArtifact[]
  canAct: { reorder: boolean; backlog: boolean }
}

export interface BacklogTask {
  task: BoardTask
  steps: readonly BoardStep[]
  /** The links from its done steps. */
  artifacts?: readonly BoardArtifact[]
  canAct: { queue: boolean; archive: boolean }
}

export interface SignOffTask {
  task: BoardTask
  /** An instant. */
  finishedAt: string
  agentSeconds: number
  yourSeconds: number
  linkCount: number
  steps: readonly BoardStep[]
  /** The links from its done steps. */
  artifacts?: readonly BoardArtifact[]
  /** `reject`: the last step, an agent's, can be sent back. */
  canAct: { signOff: boolean; followUp: boolean; archive: boolean; reject?: boolean }
}

/**
 * An action pressed on a card that waits for the server: sign off, follow-up,
 * archive, move to the backlog, or reject.
 */
export type CardAction = 'signOff' | 'followUp' | 'archive' | 'backlog' | 'reject'

/** The card action in flight, and the task it acts on. */
export interface PendingCardAction {
  taskId: string
  action: CardAction
}

export interface SignedOffTask {
  task: BoardTask
  /** An instant. */
  signedOffAt: string
}

/**
 * A signed-off task as a row of the History view shows it.
 */
export interface CompletedTask {
  task: BoardTask
  /** An instant. */
  signedOffAt: string
  steps: readonly BoardStep[]
  /** Seconds, across every step of the chain. */
  agentSeconds: number
  /** Seconds, across every step of the chain. */
  userSeconds: number
  /** The names of the sessions that completed its agent steps. */
  workers: readonly string[]
  /** The links from its done steps. */
  artifacts: readonly BoardArtifact[]
}

/**
 * One page of the completed tasks.
 */
export interface HistoryPage {
  /** Most recently signed off first. */
  rows: readonly CompletedTask[]
  /** From 1. */
  page: number
  /** At least 1. */
  pageCount: number
  /** The completed tasks the filter matches, across every page. */
  total: number
  /** What the rows were filtered by. Empty for none. */
  filter: string
}

export type SessionKind = 'dedicated' | 'worker'

export interface BoardSession {
  id: string
  kind: SessionKind
  name: string
  live: boolean
  /** The step the session claimed, if any. */
  holding?: {
    task: BoardTask
    step: { number: number; title: string }
    /** `waiting`: on your answer or your step. `blocked`: until you act in the session. */
    status: 'running' | 'waiting' | 'blocked'
  } | null
  /** An instant. Only an ended session has one. */
  endedAt?: string | null
  /** The tasks an ended session left behind. */
  released?: readonly BoardTask[]
}

export interface BoardCounts {
  yourTurn: number
  working: number
  queue: number
  toSignOff: number
}

export interface SafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface BoardData {
  /** The step that began waiting first is first. */
  yourTurn: readonly YourTurnTask[]
  working: readonly WorkingTask[]
  /** In queue order, front first. */
  queue: readonly QueueTask[]
  /** In the server's order. */
  backlog: readonly BacklogTask[]
  toSignOff: readonly SignOffTask[]
  /** The most recent first. */
  signedOff: readonly SignedOffTask[]
  sessions: readonly BoardSession[]
  counts: BoardCounts
  /** The instant a poll last brought a newer board. Null before one has. */
  updatedAt: string | null
  /** The last poll failed. */
  unreachable: boolean
  /** The host's safe-area insets, in pixels. */
  safeAreaInsets?: SafeAreaInsets | null
}
