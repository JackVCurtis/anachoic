import { describe, expect, test } from 'vitest'
import { taskViolations } from '../../../domain/invariants.js'
import {
  addToQueue,
  archive,
  claim,
  completeMyStep,
  completeStep,
  moveToBacklog,
  park,
  release,
  reorder,
  unqueue,
} from '../../../domain/transitions.js'
import type { Owner, TaskState } from '../../../domain/types.js'
import { ctx, stateOf } from '../support/domain.js'

const A = 'session-a'
const B = 'session-b'

function queued(owners: Owner[]): TaskState {
  return stateOf(
    addToQueue(
      {
        taskId: 12,
        title: 'Task 12',
        steps: owners.map((owner, index) => ({ title: `Step ${index + 1}`, owner })),
      },
      ctx('you')
    )
  )
}

/**
 * A worker has completed the agent step before your step, which now waits.
 */
function handedToYou(owners: Owner[] = ['agent', 'you', 'agent']): TaskState {
  const claimed = stateOf(claim(queued(owners), ctx(A, 1)))
  return stateOf(completeStep(claimed, ctx(A, 2), { summary: 'Planned' }))
}

/**
 * Your step is done, so the task is back in the queue, to resume with A.
 */
function backInQueue(): TaskState {
  return stateOf(completeMyStep(handedToYou(), ctx('you', 3), { note: 'Looks good' }))
}

describe('resumeWith', () => {
  test('completing an agent step whose next step is yours sets it to the completing session', () => {
    const state = handedToYou()
    expect(state.task.status).toBe('active')
    expect(state.task.resumeWith).toBe(A)
    expect(taskViolations(state)).toEqual([])
  })

  test('completing an agent step whose next step is an agent’s, or none, leaves it empty', () => {
    const next = stateOf(
      completeStep(stateOf(claim(queued(['agent', 'agent']), ctx(A))), ctx(A), { summary: 'x' })
    )
    expect(next.task.resumeWith).toBeNull()
    const last = stateOf(
      completeStep(stateOf(claim(queued(['agent']), ctx(A))), ctx(A), { summary: 'x' })
    )
    expect(last.task.resumeWith).toBeNull()
  })

  test('is kept while your steps follow one another and when the task goes back to the queue', () => {
    const yours = handedToYou(['agent', 'you', 'you', 'agent'])
    const second = stateOf(completeMyStep(yours, ctx('you', 3)))
    expect(second.task.resumeWith).toBe(A)
    const requeued = stateOf(completeMyStep(second, ctx('you', 4)))
    expect(requeued.task.status).toBe('queue')
    expect(requeued.task.resumeWith).toBe(A)
    expect(stateOf(reorder(requeued, ctx('you', 5), 1)).task.resumeWith).toBe(A)
  })

  test.each([
    ['claiming the next agent step, by the same session', () => claim(backInQueue(), ctx(A, 4))],
    ['claiming the next agent step, by another session', () => claim(backInQueue(), ctx(B, 4))],
    ['unqueueing', () => unqueue(backInQueue(), ctx('you', 4))],
    ['moving the queued task to the backlog', () => moveToBacklog(backInQueue(), ctx('you', 4))],
    ['archiving the queued task', () => archive(backInQueue(), ctx('you', 4))],
    ['parking while your step waits', () => park(handedToYou(), ctx('you', 4))],
    ['archiving while your step waits', () => archive(handedToYou(), ctx('you', 4))],
    ['finishing the last step', () => completeMyStep(handedToYou(['agent', 'you']), ctx('you', 4))],
  ])('is cleared by %s', (_name, apply) => {
    const state = stateOf(apply())
    expect(state.task.resumeWith).toBeNull()
    expect(taskViolations(state)).toEqual([])
  })

  test('is cleared by a release', () => {
    const claimed = stateOf(claim(backInQueue(), ctx(A, 4)))
    const released = stateOf(release(claimed, ctx(A, 5)))
    expect(released.task.resumeWith).toBeNull()
  })

  test('the invariant: set only while your step waits or the task is queued with an agent step current', () => {
    const running = stateOf(claim(queued(['agent', 'you']), ctx(A)))
    expect(taskViolations({ ...running, task: { ...running.task, resumeWith: A } })).toEqual([
      'T-012: resume: resumeWith session-a while active with an agent’s step running',
    ])
    const backlog = stateOf(park(handedToYou(), ctx('you', 4)))
    expect(taskViolations({ ...backlog, task: { ...backlog.task, resumeWith: A } })).toEqual([
      'T-012: resume: resumeWith session-a while backlog with your step pending',
    ])
    expect(taskViolations(backInQueue())).toEqual([])
  })
})
