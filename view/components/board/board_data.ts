import type { Owner, StepStatus } from '../types'

/**
 * The shapes the board view is given, in the board's own terms. The entry
 * maps the server's board props to them.
 */

export interface BoardTask {
  id: string
  /** Such as "T-012". */
  displayId: string
  title: string
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
    /** An agent's question. Absent for your own step. */
    question?: string | null
    /** An instant. */
    waitingSince: string
  }
  /** The session that asks. Absent for your own step. */
  sessionName?: string | null
  steps: readonly BoardStep[]
  canAct: { complete?: boolean; answer?: boolean; park: boolean }
}

export interface WorkingTask {
  task: BoardTask
  step: {
    number: number
    title: string
    /** The session's latest progress note. */
    note?: string | null
    /** An instant. */
    runningSince: string
  }
  sessionName: string
  steps: readonly BoardStep[]
}

export interface QueueTask {
  task: BoardTask
  /** From 1. */
  position: number
  nextOwner: Owner
  steps: readonly BoardStep[]
  canAct: { reorder: boolean; backlog: boolean }
}

export interface BacklogTask {
  task: BoardTask
  steps: readonly BoardStep[]
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
  canAct: { signOff: boolean; followUp: boolean; archive: boolean }
}

/**
 * An action pressed on a card that waits for the server: sign off, follow-up,
 * archive, or move to the backlog.
 */
export type CardAction = 'signOff' | 'followUp' | 'archive' | 'backlog'

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
    status: 'running' | 'waiting'
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
