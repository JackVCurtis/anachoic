import { formatTaskId } from '../shared/task_id.js'
import { currentStepIndex } from './chain.js'
import type { Session, TaskState } from './types.js'

export class InvariantError extends Error {
  name = 'InvariantError'

  constructor(readonly violations: readonly string[]) {
    super(`Board invariants broken:\n${violations.join('\n')}`)
  }
}

/**
 * The invariants of 03 that hold for one task, numbered as 03 numbers them,
 * with the open-interval rule for time on a step. An archived task is held
 * only to invariant 8.
 */
export function taskViolations({ task, steps }: TaskState): string[] {
  const found: string[] = []
  const id = formatTaskId(task.id)
  const broken = (rule: string, what: string) => found.push(`${id}: ${rule}: ${what}`)

  if (task.signedOffAt !== null && task.status !== 'done') {
    broken('8', `signed off while ${task.status}`)
  }
  if (task.archivedAt !== null) return found

  if (steps.length === 0) {
    broken('chain', 'has no steps')
    return found
  }
  steps.forEach((step, index) => {
    if (step.number !== index + 1) broken('chain', `step ${index + 1} is numbered ${step.number}`)
  })

  const currentIndex = currentStepIndex(steps)
  const current = steps[currentIndex]
  const held = (status: string) => status === 'running' || status === 'waiting'

  steps.forEach((step, index) => {
    const name = `step ${step.number}`
    if (held(step.status) && index !== currentIndex)
      broken('1', `${name} is ${step.status} but not current`)
    if (index < currentIndex && step.status !== 'done')
      broken('2', `${name} is before the current step but ${step.status}`)
    if (index > currentIndex && step.status !== 'pending')
      broken('2', `${name} is after the current step but ${step.status}`)
    if (step.owner === 'agent' && (step.claimedBy !== null) !== held(step.status)) {
      broken('6', `${name} is ${step.status} with claimedBy ${step.claimedBy ?? 'empty'}`)
    }
    if (step.owner === 'you' && step.claimedBy !== null) broken('6', `${name} is yours but claimed`)
    if (step.owner === 'you' && step.status === 'running')
      broken('step', `${name} is yours but running`)
    if (step.question !== null && !(step.owner === 'agent' && step.status === 'waiting')) {
      broken('7', `${name} has a question while ${step.owner === 'you' ? 'yours' : step.status}`)
    }
    if ((step.runningSince !== null) !== (step.status === 'running')) {
      broken('time', `${name} is ${step.status} with runningSince ${step.runningSince ?? 'empty'}`)
    }
    if (step.artifactUrl !== null && !(step.status === 'done' && step.outputFormat !== null)) {
      const format = step.outputFormat === null ? ' with no output format' : ''
      broken('artifact', `${name} has an artifact while ${step.status}${format}`)
    }
    if ((step.waitingSince !== null) !== (step.status === 'waiting')) {
      broken('time', `${name} is ${step.status} with waitingSince ${step.waitingSince ?? 'empty'}`)
    }
  })

  const active = held(current.status)
  if ((task.status === 'active') !== active)
    broken('3', `task is ${task.status} and its current step ${current.status}`)
  if ((task.status === 'backlog' || task.status === 'queue') && current.status !== 'pending') {
    broken('4', `task is ${task.status} and its current step ${current.status}`)
  }
  const allDone = steps.every((step) => step.status === 'done')
  if ((task.status === 'done') !== allDone)
    broken(
      '5',
      `task is ${task.status} and ${allDone ? 'every step is done' : 'a step is not done'}`
    )
  if (task.status === 'queue' && current.owner !== 'agent')
    broken('10', 'queued with your step current')
  const resumable =
    (task.status === 'active' && current.owner === 'you' && current.status === 'waiting') ||
    (task.status === 'queue' && current.owner === 'agent')
  if (task.resumeWith !== null && !resumable) {
    broken(
      'resume',
      `resumeWith ${task.resumeWith} while ${task.status} with ${current.owner === 'you' ? 'your' : 'an agent’s'} step ${current.status}`
    )
  }

  return found
}

/**
 * The assignment invariant of 11: a task's assignedTo names a worker session
 * whose endedAt is empty.
 */
export function assignmentViolations(
  states: readonly TaskState[],
  sessions: readonly Session[]
): string[] {
  const byId = new Map(sessions.map((session) => [session.id, session]))
  const found: string[] = []
  for (const { task } of states) {
    if (task.assignedTo === null) continue
    const session = byId.get(task.assignedTo)
    if (!session || session.kind !== 'worker' || session.endedAt !== null) {
      const what = !session
        ? 'an unknown session'
        : session.kind !== 'worker'
          ? `the ${session.kind} session`
          : 'a session that ended'
      found.push(`${formatTaskId(task.id)}: assigned: assigned to ${what}, ${task.assignedTo}`)
    }
  }
  return found
}

/**
 * Every task's invariants, and invariant 9 over the queue: a task has a queue
 * position exactly when it is queued and not archived, and the positions run
 * from 1 to n with no gap and no repeat. With the sessions, the assignment
 * invariant too.
 */
export function boardViolations(
  states: readonly TaskState[],
  sessions?: readonly Session[]
): string[] {
  const found = states.flatMap(taskViolations)
  if (sessions) found.push(...assignmentViolations(states, sessions))
  const positions: number[] = []
  for (const { task } of states) {
    const queued = task.status === 'queue' && task.archivedAt === null
    if (queued !== (task.queuePosition !== null)) {
      found.push(
        `${formatTaskId(task.id)}: 9: ${task.status}${task.archivedAt ? ', archived,' : ''} with queue position ${task.queuePosition ?? 'empty'}`
      )
    }
    if (task.queuePosition !== null) positions.push(task.queuePosition)
  }
  positions.sort((a, b) => a - b)
  if (positions.some((position, index) => position !== index + 1)) {
    found.push(`queue: 9: positions are ${positions.join(', ')}`)
  }
  return found
}

export function checkTask(state: TaskState): void {
  const found = taskViolations(state)
  if (found.length > 0) throw new InvariantError(found)
}

export function checkBoard(states: readonly TaskState[], sessions?: readonly Session[]): void {
  const found = boardViolations(states, sessions)
  if (found.length > 0) throw new InvariantError(found)
}
