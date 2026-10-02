import { OUTPUT_FORMAT_WORDS, type OutputFormat } from '../shared/output_format.js'
import { formatTaskId } from '../shared/task_id.js'
import type { TaskStatus } from './types.js'

/**
 * A service's refusal: a code for the caller and a sentence for whoever reads
 * it. A refusal changes nothing.
 */
export type RefusalCode =
  | 'not_found'
  | 'not_current'
  | 'wrong_status'
  | 'not_yours'
  | 'nothing_to_claim'
  | 'unanswered'
  | 'signed_off'
  | 'archived'
  | 'invalid'
  | 'busy'

export interface Refusal {
  readonly code: RefusalCode
  readonly sentence: string
}

export function refusal(code: RefusalCode, sentence: string): Refusal {
  return { code, sentence }
}

export function isRefusal(value: unknown): value is Refusal {
  return typeof value === 'object' && value !== null && 'code' in value && 'sentence' in value
}

/**
 * Where a task is, as a refusal's sentence says it: "in the backlog", "active".
 */
export function whereTaskIs(status: TaskStatus): string {
  switch (status) {
    case 'backlog':
      return 'in the backlog'
    case 'queue':
      return 'in the queue'
    case 'active':
      return 'active'
    case 'done':
      return 'done'
  }
}

function stepOf(taskId: number, stepNumber: number) {
  return `Step ${stepNumber} of ${formatTaskId(taskId)}`
}

export function notFound(taskId: number, stepNumber?: number): Refusal {
  const name = stepNumber === undefined ? formatTaskId(taskId) : stepOf(taskId, stepNumber)
  return refusal('not_found', `${name} does not exist`)
}

export function notCurrent(taskId: number, stepNumber: number): Refusal {
  return refusal('not_current', `${stepOf(taskId, stepNumber)} is not the current step`)
}

/**
 * The task is not where the transition starts from. `expected` lists the
 * statuses it does start from; `addendum` says what to do instead.
 */
export function wrongStatus(
  taskId: number,
  actual: TaskStatus,
  expected: readonly TaskStatus[],
  addendum?: string
): Refusal {
  const sentence = `${formatTaskId(taskId)} is ${whereTaskIs(actual)}, not ${expected.map(whereTaskIs).join(' or ')}`
  return refusal('wrong_status', addendum ? `${sentence}. ${addendum}` : sentence)
}

export function wrongStepStatus(taskId: number, stepNumber: number, why: string): Refusal {
  return refusal('wrong_status', `${stepOf(taskId, stepNumber)} ${why}`)
}

export function notRunning(taskId: number, stepNumber: number): Refusal {
  return refusal('wrong_status', `${stepOf(taskId, stepNumber)} is not running`)
}

export function notBlocked(taskId: number, stepNumber: number): Refusal {
  return refusal('wrong_status', `${stepOf(taskId, stepNumber)} is not blocked`)
}

export function blocked(taskId: number, stepNumber: number): Refusal {
  return refusal(
    'wrong_status',
    `${stepOf(taskId, stepNumber)} is blocked. Call unblock_step first.`
  )
}

export function claimedByAnother(taskId: number, stepNumber: number, sessionName: string): Refusal {
  return refusal('not_yours', `${stepOf(taskId, stepNumber)} is claimed by ${sessionName}`)
}

export function yourStep(taskId: number, stepNumber: number): Refusal {
  return refusal('not_yours', `${stepOf(taskId, stepNumber)} is yours, not an agent's`)
}

export function agentStep(taskId: number, stepNumber: number): Refusal {
  return refusal('not_yours', `${stepOf(taskId, stepNumber)} is an agent's, not yours`)
}

/**
 * `action` names the action, with {task} where the task's display id goes.
 */
export function onlyYou(taskId: number, action: string): Refusal {
  return refusal('not_yours', `Only you can ${action.replace('{task}', formatTaskId(taskId))}`)
}

export function onlyASession(taskId: number, action: string): Refusal {
  return refusal(
    'not_yours',
    `Only a session can ${action.replace('{task}', formatTaskId(taskId))}`
  )
}

export function assignedToAnother(taskId: number, sessionName: string): Refusal {
  return refusal('not_yours', `${formatTaskId(taskId)} is assigned to ${sessionName}`)
}

export function notALiveWorker(sessionName: string): Refusal {
  return refusal('invalid', `${sessionName} is not a live worker`)
}

export function nothingToClaim(): Refusal {
  return refusal('nothing_to_claim', 'Nothing in the queue needs an agent')
}

export function unanswered(taskId: number, stepNumber: number): Refusal {
  return refusal('unanswered', `${stepOf(taskId, stepNumber)} is waiting for your answer`)
}

export function signedOff(taskId: number): Refusal {
  return refusal('signed_off', `${formatTaskId(taskId)} is signed off`)
}

export function archived(taskId: number): Refusal {
  return refusal('archived', `${formatTaskId(taskId)} was archived`)
}

export function invalid(sentence: string): Refusal {
  return refusal('invalid', sentence)
}

export function needsArtifact(taskId: number, stepNumber: number, format: OutputFormat): Refusal {
  return invalid(
    `${stepOf(taskId, stepNumber)} needs ${OUTPUT_FORMAT_WORDS[format].needed} (artifact_url)`
  )
}

export function notAWebAddress(): Refusal {
  return invalid('That is not a web address')
}

export const BUSY: Refusal = refusal('busy', 'The board is busy. Try again.')
