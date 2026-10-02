// Copied from anachoic inertia/components/helpers/steps.ts at fd99e0d
import type { Owner, StepStatus } from '../types'
import { assistive, fillTemplate, taskEntry, taskView, yourTurn } from './strings'
import { formatDuration, formatElapsed, formatWaited } from './time'
import { plural } from './words'

function hasName(name: string | null | undefined): name is string {
  return name !== null && name !== undefined && name !== ''
}

/**
 * `generic` is the chain preview's chip, where an agent is only "agent".
 * `named` is the pips' and the task view's, where an agent step is named by
 * the session that holds it.
 */
export type OwnerLabelForm = 'generic' | 'named'

/**
 * The word in an owner chip. Your step is always "you". An agent step is
 * "agent" in the generic form, and the name of the session that holds it in
 * the named form, or "agent" when no session holds it.
 */
export function ownerLabel(
  owner: Owner,
  sessionName: string | null | undefined,
  form: OwnerLabelForm
): string {
  if (owner === 'you') {
    return taskEntry.youChip
  }
  return form === 'named' && hasName(sessionName) ? sessionName : taskEntry.agentChip
}

/**
 * `short` is the Your turn card's counter, `long` the session card's and the
 * task view's.
 */
export type StepCounterForm = 'short' | 'long'

/**
 * "Step 3/5" in the short form, "Step 3 of 5" in the long one.
 */
export function stepCounter(step: number, stepCount: number, form: StepCounterForm): string {
  return form === 'short'
    ? fillTemplate(yourTurn.stepCounter, { n: step, m: stepCount })
    : fillTemplate(taskView.stepCounter, { n: step, m: stepCount })
}

export type PipAppearance = 'done' | 'running' | 'waiting' | 'pending'

/**
 * The look of one pip. A waiting step is `waiting` whatever its owner, and
 * your running step is `waiting` too, because it is yours to do.
 */
export function pipAppearance(status: StepStatus, owner: Owner): PipAppearance {
  if (status === 'running') {
    return owner === 'agent' ? 'running' : 'waiting'
  }
  return status
}

/**
 * The tooltip of one pip: "api-server · Draft the bus adapter", "you · Review
 * the PR and merge".
 */
export function pipTitle(
  owner: Owner,
  sessionName: string | null | undefined,
  title: string
): string {
  return `${ownerLabel(owner, sessionName, 'named')} · ${title}`
}

export type PipStep = {
  owner: Owner
  status: StepStatus
}

/**
 * The pips spoken as one sentence: "5 steps: 2 done, 1 waiting on you, 2 not
 * started". Each step is counted by its pip's look, so your running step
 * counts as waiting on you. A part whose count is zero is left out.
 */
export function pipSummary(steps: readonly PipStep[]): string {
  const counts: Record<PipAppearance, number> = { done: 0, running: 0, waiting: 0, pending: 0 }
  for (const step of steps) {
    counts[pipAppearance(step.status, step.owner)] += 1
  }

  const parts = [
    counts.done > 0 ? fillTemplate(assistive.pipDone, { d: counts.done }) : '',
    counts.running > 0 ? fillTemplate(assistive.pipRunning, { r: counts.running }) : '',
    counts.waiting > 0 ? fillTemplate(assistive.pipWaiting, { w: counts.waiting }) : '',
    counts.pending > 0 ? fillTemplate(assistive.pipNotStarted, { p: counts.pending }) : '',
  ].filter((part) => part !== '')

  return fillTemplate(assistive.pipSummaryIntro, {
    'n steps': plural(steps.length, 'step'),
    'parts': parts.join(', '),
  })
}

/**
 * The facts `stepStatusLabel` needs. Each status reads only its own:
 * a done step its duration, a running step when it started and the seconds
 * of its earlier attempts, a waiting step when it began to wait.
 */
export type StepTiming = {
  status: StepStatus
  durationSeconds?: number | null
  startedAt?: string | null
  earlierSeconds?: number | null
  waitingSince?: string | null
}

/**
 * The status label of a step in the task view: "Done · 9m", "Done",
 * "Running · 6m 12s", "Waiting on you · 14m", "Not started". A done step
 * with no duration reads "Done". A missing instant counts as `now`.
 */
export function stepStatusLabel(step: StepTiming, now: string): string {
  switch (step.status) {
    case 'done':
      return step.durationSeconds !== null &&
        step.durationSeconds !== undefined &&
        step.durationSeconds > 0
        ? fillTemplate(taskView.stepDoneAt, { time: formatDuration(step.durationSeconds) })
        : taskView.stepDone
    case 'running':
      return fillTemplate(taskView.stepRunning, {
        time: formatElapsed(step.startedAt ?? now, now, step.earlierSeconds ?? 0),
      })
    case 'waiting':
      return fillTemplate(taskView.stepWaiting, {
        time: formatWaited(step.waitingSince ?? now, now),
      })
    case 'pending':
      return taskView.stepNotStarted
  }
}

export type TimelineAppearance =
  | 'done'
  | 'current-agent-running'
  | 'current-agent-pending'
  | 'current-waiting'
  | 'current-you-pending'
  | 'pending'

/**
 * The look of a step in the task view's chain. A current step that waits on
 * you is `current-waiting` whatever its owner. Your current step that is not
 * waiting is `current-you-pending`. A step that is neither done
 * nor current is `pending`.
 */
export function timelineAppearance(
  status: StepStatus,
  owner: Owner,
  isCurrent: boolean
): TimelineAppearance {
  if (status === 'done') {
    return 'done'
  }
  if (!isCurrent) {
    return 'pending'
  }
  if (status === 'waiting') {
    return 'current-waiting'
  }
  if (owner === 'you') {
    return 'current-you-pending'
  }
  return status === 'running' ? 'current-agent-running' : 'current-agent-pending'
}

/**
 * The note beside a chain preview: "3 steps · 1 for you".
 */
export function chainNote(stepCount: number, yourStepCount: number): string {
  return fillTemplate(taskEntry.chainNote, {
    'n steps': plural(stepCount, 'step'),
    'h': yourStepCount,
  })
}

/**
 * One row of a chain preview.
 */
export type ChainPreviewRow = {
  /** The step's number in the task's chain, counted from 1. */
  number: number
  owner: Owner
  title: string
  /** The session that holds the step. A row with one shows the named chip. */
  sessionName?: string | null
}
