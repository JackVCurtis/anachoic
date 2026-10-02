import { expect } from 'vitest'
import { isRefusal, type Refusal } from '../../../domain/refusal.js'
import { add, type Change, type Context, type Outcome } from '../../../domain/transitions.js'
import { YOU, type Actor, type Owner, type TaskState } from '../../../domain/types.js'

const START = Date.UTC(2026, 9, 1, 12, 0, 0)

/**
 * The instant `seconds` after a fixed start.
 */
export function at(seconds: number): string {
  return new Date(START + seconds * 1000).toISOString()
}

export const NAMES: Record<string, string> = {
  'dedicated': 'This chat',
  'session-a': 'api-server',
  'session-b': 'web-client',
  'session-c': 'docs',
}

export function ctx(actor: Actor = YOU, seconds = 0): Context {
  return { actor, now: at(seconds), nameOf: (id) => NAMES[id] }
}

/**
 * A task in the backlog with one step per owner given, titled by number.
 */
export function backlogTask(owners: readonly Owner[], taskId = 12, actor: Actor = YOU): TaskState {
  const { task, steps } = add(
    {
      taskId,
      title: `Task ${taskId}`,
      steps: owners.map((owner, index) => ({ title: `Step ${index + 1}`, owner })),
    },
    ctx(actor)
  )
  return { task, steps }
}

/**
 * The change an outcome made, failing the test if it was refused.
 */
export function accepted(outcome: Outcome): Change {
  if (isRefusal(outcome)) {
    expect.fail(`Refused with ${outcome.code}: ${outcome.sentence}`)
  }
  return outcome
}

export function stateOf(outcome: Outcome): TaskState {
  const { task, steps } = accepted(outcome)
  return { task, steps }
}

export function refused(outcome: Outcome): Refusal {
  if (!isRefusal(outcome)) {
    expect.fail(`Expected a refusal, but the task became ${outcome.task.status}`)
  }
  return outcome
}
