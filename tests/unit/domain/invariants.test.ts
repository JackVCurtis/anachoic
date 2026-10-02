import { describe, expect, test } from 'vitest'
import {
  agentSeconds,
  claimedBy,
  holdings,
  isLive,
  sessionActivity,
  yourSeconds,
} from '../../../domain/derived.js'
import {
  boardViolations,
  checkBoard,
  checkTask,
  InvariantError,
  taskViolations,
} from '../../../domain/invariants.js'
import { claim, queue } from '../../../domain/transitions.js'
import type { Session, Step, TaskState } from '../../../domain/types.js'
import { at, backlogTask, ctx, stateOf } from '../support/domain.js'

function withStep(state: TaskState, index: number, change: Partial<Step>): TaskState {
  return {
    ...state,
    steps: state.steps.map((step, i) => (i === index ? { ...step, ...change } : step)),
  }
}

function rules(state: TaskState) {
  return taskViolations(state).map((line) => line.split(': ')[1])
}

describe('checkTask', () => {
  const running = stateOf(
    claim(stateOf(queue(backlogTask(['agent', 'agent']), ctx('you'))), ctx('session-a', 1))
  )

  test('passes a consistent task', () => {
    expect(() => checkTask(running)).not.toThrow()
  })

  test.each([
    ['1', withStep(running, 1, { status: 'running', claimedBy: 'session-a', runningSince: at(1) })],
    ['2', withStep(backlogTask(['agent', 'agent']), 1, { status: 'done' })],
    ['3', { ...running, task: { ...running.task, status: 'queue' as const } }],
    ['5', { ...running, task: { ...running.task, status: 'done' as const } }],
    ['6', withStep(running, 0, { claimedBy: null })],
    ['7', withStep(running, 0, { question: 'Why?' })],
    ['8', { ...running, task: { ...running.task, signedOffAt: at(5) } }],
    [
      '10',
      { ...backlogTask(['you']), task: { ...backlogTask(['you']).task, status: 'queue' as const } },
    ],
  ])('catches a break of invariant %s', (rule, state) => {
    expect(rules(state)).toContain(rule)
    expect(() => checkTask(state)).toThrow(InvariantError)
  })

  test('holds an archived task only to invariant 8', () => {
    const broken = withStep(running, 0, { claimedBy: null })
    const archived = { ...broken, task: { ...broken.task, archivedAt: at(9) } }
    expect(taskViolations(archived)).toEqual([])
    expect(rules({ ...archived, task: { ...archived.task, signedOffAt: at(9) } })).toEqual(['8'])
  })
})

describe('checkBoard', () => {
  const queued = (id: number, position: number | null): TaskState => {
    const state = stateOf(queue(backlogTask(['agent'], id), ctx('you')))
    return { ...state, task: { ...state.task, queuePosition: position } }
  }

  test('passes positions 1 to n', () => {
    expect(() => checkBoard([queued(1, 2), queued(2, 1), backlogTask(['agent'], 3)])).not.toThrow()
  })

  test.each([
    ['a gap', [queued(1, 1), queued(2, 3)]],
    ['a repeat', [queued(1, 1), queued(2, 1)]],
    ['a queued task with no position', [queued(1, null)]],
    [
      'a backlog task with a position',
      [
        {
          ...backlogTask(['agent'], 1),
          task: { ...backlogTask(['agent'], 1).task, queuePosition: 1 },
        },
      ],
    ],
    [
      'an archived task with a position',
      [{ ...queued(1, 1), task: { ...queued(1, 1).task, archivedAt: at(1) } }],
    ],
  ])('catches %s', (_label, states) => {
    expect(boardViolations(states).some((line) => line.includes(': 9: '))).toBe(true)
  })
})

describe('Derived facts', () => {
  const session = (id: string, lastSeen: number, endedAt: string | null = null): Session => ({
    id,
    kind: 'worker',
    name: id,
    projectDir: null,
    pid: 1,
    firstSeenAt: at(0),
    lastSeenAt: at(lastSeen),
    endedAt,
    removedAt: null,
  })

  test('a session is live until its last sighting is more than 2 minutes old, or it ended', () => {
    expect(isLive(session('a', 0), at(120))).toBe(true)
    expect(isLive(session('a', 0), at(121))).toBe(false)
    expect(isLive(session('a', 0, at(1)), at(1))).toBe(false)
  })

  test('claimedBy names the session holding the current step', () => {
    const state = stateOf(
      claim(stateOf(queue(backlogTask(['agent']), ctx('you'))), ctx('session-a'))
    )
    expect(claimedBy(state, () => ({ name: 'api-server', live: true }))).toEqual({
      id: 'session-a',
      name: 'api-server',
      live: true,
    })
    expect(claimedBy(backlogTask(['agent']), () => undefined)).toBeNull()
  })

  test('agent seconds sum agent running time; your seconds sum your steps and the agent’s waits', () => {
    const steps = backlogTask(['agent', 'you']).steps
    steps[0] = { ...steps[0], elapsedSeconds: 100, waitedSeconds: 30 }
    steps[1] = { ...steps[1], elapsedSeconds: 50 }
    expect(agentSeconds(steps)).toBe(100)
    expect(yourSeconds(steps)).toBe(80)
  })

  test('session activity lists live sessions with the step each holds', () => {
    const held = stateOf(
      claim(stateOf(queue(backlogTask(['agent'], 4), ctx('you'))), ctx('session-a', 1))
    )
    const activity = sessionActivity(
      [session('session-a', 60), session('session-b', 60), session('gone', 0, at(1))],
      [held],
      at(90)
    )
    expect(
      activity.map((each) => [
        each.session.id,
        each.holding?.task.id ?? null,
        each.holding?.status ?? null,
      ])
    ).toEqual([
      ['session-a', 4, 'running'],
      ['session-b', null, null],
    ])
    expect(holdings('session-b', [held])).toEqual([])
  })
})
