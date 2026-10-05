import { describe, expect, test } from 'vitest'
import { canAct } from '../../../domain/derived.js'
import { taskViolations } from '../../../domain/invariants.js'
import {
  addToQueue,
  claim,
  completeStep,
  reject,
  release,
  signOff,
} from '../../../domain/transitions.js'
import type { Owner, TaskState } from '../../../domain/types.js'
import { accepted, at, ctx, refused, stateOf } from '../support/domain.js'

const A = 'session-a'
const B = 'session-b'
const NOTE = 'The PR targets the wrong branch'

function queued(owners: Owner[], outputFormat: 'pull_request' | null = null): TaskState {
  return stateOf(
    addToQueue(
      {
        taskId: 12,
        title: 'Task 12',
        steps: owners.map((owner, index) => ({
          title: `Step ${index + 1}`,
          owner,
          outputFormat: owner === 'agent' ? outputFormat : null,
        })),
      },
      ctx('you')
    )
  )
}

/**
 * A completed step 1 by A, with a pull request, and your step 2 waiting
 * since 100 seconds in.
 */
function handedToYou(owners: Owner[] = ['agent', 'you']): TaskState {
  const claimed = stateOf(claim(queued(owners, 'pull_request'), ctx(A, 10)))
  return stateOf(
    completeStep(claimed, ctx(A, 100), {
      summary: 'Opened the PR',
      artifactUrl: 'https://example.com/pr/1',
      links: [{ label: 'PR', url: 'https://example.com/pr/1' }],
    })
  )
}

function rejectAsYou(state: TaskState, seconds = 160, resumeWith: string | null = A) {
  return reject(state, ctx('you', seconds), { note: NOTE, resumeWith })
}

describe('Reject', () => {
  test("reopens the agent step before the user's step and sends the task to the front of the queue", () => {
    const change = accepted(rejectAsYou(handedToYou()))
    const [agent, yours] = change.steps
    expect(change.task.status).toBe('queue')
    expect(change.queue).toEqual({ kind: 'join', placement: 'first' })
    expect(change.task.resumeWith).toBe(A)
    expect(agent).toMatchObject({
      status: 'pending',
      rejection: NOTE,
      artifactUrl: null,
      finishedAt: null,
      claimedBy: null,
      summary: 'Opened the PR',
      links: [{ label: 'PR', url: 'https://example.com/pr/1' }],
      elapsedSeconds: 90,
    })
    expect(yours).toMatchObject({ status: 'pending', waitingSince: null, elapsedSeconds: 60 })
    expect(change.events.map((event) => [event.kind, event.detail, event.stepId])).toEqual([
      ['rejected', NOTE, agent.id],
      ['queued', 'Joined the front of the queue', null],
    ])
    expect(taskViolations(change)).toEqual([])
  })

  test('the worker that claims it again completes it, which clears the rejection', () => {
    const rejected = stateOf(rejectAsYou(handedToYou()))
    const claimed = stateOf(claim(rejected, ctx(A, 200)))
    expect(claimed.steps[0].rejection).toBe(NOTE)
    expect(claimed.task.resumeWith).toBeNull()
    const redone = stateOf(
      completeStep(claimed, ctx(A, 260), {
        summary: 'Retargeted the PR',
        artifactUrl: 'https://example.com/pr/2',
      })
    )
    expect(redone.steps[0]).toMatchObject({
      status: 'done',
      rejection: null,
      artifactUrl: 'https://example.com/pr/2',
      elapsedSeconds: 150,
    })
    expect(redone.task.status).toBe('active')
    expect(redone.steps[1].status).toBe('waiting')
    expect(redone.task.resumeWith).toBe(A)
  })

  test('the rejection survives a release, so the next claimant reads it', () => {
    const claimed = stateOf(claim(stateOf(rejectAsYou(handedToYou())), ctx(B, 200)))
    const released = stateOf(release(claimed, ctx(B, 300)))
    expect(released.steps[0].rejection).toBe(NOTE)
    expect(taskViolations(released)).toEqual([])
  })

  test('takes a null resumeWith when the worker has ended', () => {
    expect(accepted(rejectAsYou(handedToYou(), 160, null)).task.resumeWith).toBeNull()
  })

  test('is refused to a session', () => {
    const refusal = refused(reject(handedToYou(), ctx(A, 160), { note: NOTE, resumeWith: A }))
    expect(refusal).toEqual({
      code: 'not_yours',
      sentence: 'Only the user can reject a step of T-012',
    })
  })

  test('is refused when no agent output is in front of the user', () => {
    const nothing = { code: 'wrong_status', sentence: 'T-012 has no agent output to reject' }
    expect(refused(rejectAsYou(queued(['agent', 'you'])))).toEqual(nothing)
    expect(refused(rejectAsYou(stateOf(claim(queued(['agent', 'you']), ctx(A)))))).toEqual(nothing)
    expect(refused(rejectAsYou(queued(['you', 'agent'])))).toEqual(nothing)
    expect(canAct(queued(['you', 'agent'])).reject).toBe(false)
    expect(canAct(handedToYou()).reject).toBe(true)
  })

  test('is refused on a signed-off task', () => {
    const signed = stateOf(signOff(doneTask(), ctx('you', 200)))
    expect(refused(rejectAsYou(signed, 300)).code).toBe('signed_off')
    expect(canAct(signed).reject).toBe(false)
  })
})

/**
 * Task 12 with one agent step, done by A.
 */
function doneTask(): TaskState {
  const claimed = stateOf(claim(queued(['agent']), ctx(A, 10)))
  return stateOf(completeStep(claimed, ctx(A, 100), { summary: 'Opened the PR' }))
}

describe('Reject on a done task', () => {
  test('sends it back to the queue, clearing finishedAt', () => {
    const done = doneTask()
    expect(done.task.finishedAt).toBe(at(100))
    const change = accepted(rejectAsYou(done))
    expect(change.task).toMatchObject({ status: 'queue', finishedAt: null, resumeWith: A })
    expect(change.steps[0]).toMatchObject({ status: 'pending', rejection: NOTE })
    expect(taskViolations(change)).toEqual([])
  })
})
