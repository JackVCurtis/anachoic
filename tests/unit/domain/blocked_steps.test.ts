import { describe, expect, test } from 'vitest'
import { currentStep } from '../../../domain/chain.js'
import { canAct, counts, holdings, listOf } from '../../../domain/derived.js'
import { taskViolations } from '../../../domain/invariants.js'
import {
  addToQueue,
  answer,
  archive,
  ask,
  block,
  claim,
  completeStep,
  note,
  park,
  release,
  unblock,
  type Outcome,
} from '../../../domain/transitions.js'
import type { TaskState } from '../../../domain/types.js'
import { accepted, ctx, typed, refused, stateOf, textForm } from '../support/domain.js'

const A = 'session-a'
const B = 'session-b'

/**
 * T-012 with step 2 claimed and running by A.
 */
function running(): TaskState {
  const queued = stateOf(
    addToQueue(
      {
        taskId: 12,
        title: 'Task 12',
        steps: [
          { title: 'Plan', owner: 'agent' },
          { title: 'Deploy', owner: 'agent' },
        ],
      },
      ctx('you')
    )
  )
  const first = stateOf(claim(queued, ctx(A, 0)))
  const requeued = stateOf(completeStep(first, ctx(A, 10), { summary: 'Planned' }))
  return stateOf(claim(requeued, ctx(A, 20)))
}

function blockedState(): TaskState {
  return stateOf(block(running(), ctx(A, 80), 'needs AWS credentials'))
}

function expectRefusal(outcome: Outcome, code: string, sentence: string) {
  expect(refused(outcome)).toEqual({ code, sentence })
}

describe('Block', () => {
  test('by the claiming session: running to waiting, with the reason, the time and a blocked event', () => {
    const change = accepted(block(running(), ctx(A, 80), 'needs AWS credentials'))
    const step = currentStep(change.steps)
    expect(change.task.status).toBe('active')
    expect(step).toMatchObject({
      status: 'waiting',
      claimedBy: A,
      blockedReason: 'needs AWS credentials',
      blockedAt: ctx(A, 80).now,
      waitingSince: ctx(A, 80).now,
      runningSince: null,
      form: null,
      elapsedSeconds: 60,
    })
    expect(change.events.map((event) => [event.kind, event.detail, event.sessionId])).toEqual([
      ['blocked', 'needs AWS credentials', A],
    ])
    expect(taskViolations(change)).toEqual([])
  })

  test('by another session is refused with not_yours', () => {
    expectRefusal(
      block(running(), ctx(B, 80), 'mine'),
      'not_yours',
      'Step 2 of T-012 is claimed by api-server'
    )
  })

  test.each([
    ['already blocked', () => blockedState()],
    ['waiting on a question', () => stateOf(ask(running(), ctx(A, 30), textForm('Which?')))],
  ])('a step %s is refused as not running', (_name, state) => {
    expectRefusal(
      block(state(), ctx(A, 90), 'again'),
      'wrong_status',
      'Step 2 of T-012 is not running'
    )
  })
})

describe('Unblock', () => {
  test('by the claiming session: waiting to running, both fields cleared, the time blocked counted as waited, and an unblocked event with the note', () => {
    const change = accepted(unblock(blockedState(), ctx(A, 200), 'Credentials are in place'))
    const step = currentStep(change.steps)
    expect(step).toMatchObject({
      status: 'running',
      blockedReason: null,
      blockedAt: null,
      waitingSince: null,
      runningSince: ctx(A, 200).now,
      waitedSeconds: 120,
      elapsedSeconds: 60,
    })
    expect(change.events.map((event) => [event.kind, event.detail])).toEqual([
      ['unblocked', 'Credentials are in place'],
    ])
    expect(taskViolations(change)).toEqual([])
  })

  test('without a note records Unblocked', () => {
    const change = accepted(unblock(blockedState(), ctx(A, 200)))
    expect(change.events.map((event) => event.detail)).toEqual(['Unblocked'])
  })

  test('a step that is not blocked is refused', () => {
    expectRefusal(unblock(running(), ctx(A, 90)), 'wrong_status', 'Step 2 of T-012 is not blocked')
    expectRefusal(
      unblock(stateOf(ask(running(), ctx(A, 30), textForm('Which?'))), ctx(A, 90)),
      'wrong_status',
      'Step 2 of T-012 is not blocked'
    )
  })

  test('by another session is refused with not_yours', () => {
    expectRefusal(
      unblock(blockedState(), ctx(B, 90)),
      'not_yours',
      'Step 2 of T-012 is claimed by api-server'
    )
  })
})

describe('A blocked step', () => {
  test.each([
    ['complete_step', (state: TaskState) => completeStep(state, ctx(A, 90), { summary: 'Done' })],
    ['ask_you', (state: TaskState) => ask(state, ctx(A, 90), textForm('Which?'))],
    ['update_step', (state: TaskState) => note(state, ctx(A, 90), { note: 'Progress' })],
  ])('refuses %s until it is unblocked', (_name, apply) => {
    expectRefusal(
      apply(blockedState()),
      'wrong_status',
      'Step 2 of T-012 is blocked. Call unblock_step first.'
    )
  })

  test('is not a question you can answer', () => {
    expectRefusal(
      answer(blockedState(), ctx('you', 90), typed('Yes')),
      'wrong_status',
      'Step 2 of T-012 is not waiting for an answer'
    )
    expect(canAct(blockedState()).answer).toBe(false)
  })

  test.each([
    ['release', () => release(blockedState(), ctx(A, 90))],
    ['park', () => park(blockedState(), ctx('you', 90))],
    ['archive', () => archive(blockedState(), ctx('you', 90))],
  ])('%s clears the reason and the time', (_name, apply) => {
    const change = accepted(apply())
    const step = change.steps[1]
    expect(step).toMatchObject({ status: 'pending', blockedReason: null, blockedAt: null })
    expect(step.waitedSeconds).toBe(10)
    expect(taskViolations(change)).toEqual([])
  })

  test('puts its task in Your turn, counts towards it, and is held as blocked', () => {
    const state = blockedState()
    expect(listOf(state)).toBe('yourTurn')
    expect(counts([state])).toEqual({ yourTurn: 1, working: 0, queue: 0, toSignOff: 0 })
    expect(holdings(A, [state]).map((held) => held.status)).toEqual(['blocked'])
    expect(holdings(A, [running()]).map((held) => held.status)).toEqual(['running'])
  })
})

describe('The invariants of 12', () => {
  test('a blocked reason only on an agent step that is waiting', () => {
    const state = running()
    const steps = state.steps.map((step, index) =>
      index === 1 ? { ...step, blockedReason: 'x', blockedAt: ctx().now } : step
    )
    expect(taskViolations({ ...state, steps })).toEqual([
      'T-012: blocked: step 2 has a blocked reason while running',
    ])
  })

  test('a waiting agent step has exactly one of a form and a blocked reason', () => {
    const state = blockedState()
    const both = state.steps.map((step, index) =>
      index === 1 ? { ...step, form: textForm('Which?') } : step
    )
    expect(taskViolations({ ...state, steps: both })).toEqual([
      'T-012: blocked: step 2 waits with both a form and a blocked reason',
    ])
    const neither = state.steps.map((step, index) =>
      index === 1 ? { ...step, blockedReason: null, blockedAt: null } : step
    )
    expect(taskViolations({ ...state, steps: neither })).toEqual([
      'T-012: blocked: step 2 waits with neither a form nor a blocked reason',
    ])
  })
})
