// Copied from anachoic inertia/components/helpers/steps.test.ts at fd99e0d
import { describe, expect, test } from 'vitest'
import type { Owner, StepStatus } from '../types'
import {
  chainNote,
  ownerLabel,
  pipAppearance,
  pipSummary,
  pipTitle,
  stepCounter,
  stepStatusLabel,
  timelineAppearance,
} from './steps'
import type { PipStep, TimelineAppearance } from './steps'

const NOW = '2026-03-12T09:41:00.000Z'

/**
 * The instant `seconds` before `NOW`.
 */
function before(seconds: number) {
  return new Date(Date.parse(NOW) - seconds * 1000).toISOString()
}

describe('ownerLabel', () => {
  test.each<{
    owner: Owner
    sessionName: string | null | undefined
    form: 'generic' | 'named'
    expected: string
  }>([
    { owner: 'you', sessionName: undefined, form: 'generic', expected: 'user' },
    { owner: 'you', sessionName: undefined, form: 'named', expected: 'user' },
    { owner: 'you', sessionName: 'planner', form: 'named', expected: 'user' },
    { owner: 'agent', sessionName: 'planner', form: 'generic', expected: 'agent' },
    { owner: 'agent', sessionName: 'planner', form: 'named', expected: 'planner' },
    { owner: 'agent', sessionName: 'This chat', form: 'named', expected: 'This chat' },
    { owner: 'agent', sessionName: undefined, form: 'named', expected: 'agent' },
    { owner: 'agent', sessionName: null, form: 'named', expected: 'agent' },
    { owner: 'agent', sessionName: '', form: 'named', expected: 'agent' },
  ])('$owner, $sessionName, $form gives "$expected"', ({ owner, sessionName, form, expected }) => {
    expect(ownerLabel(owner, sessionName, form)).toBe(expected)
  })
})

describe('stepCounter', () => {
  test.each([
    { step: 3, count: 5, form: 'short', expected: 'Step 3/5' },
    { step: 3, count: 5, form: 'long', expected: 'Step 3 of 5' },
    { step: 1, count: 1, form: 'short', expected: 'Step 1/1' },
    { step: 11, count: 12, form: 'long', expected: 'Step 11 of 12' },
  ] as const)('$step of $count, $form, gives "$expected"', ({ step, count, form, expected }) => {
    expect(stepCounter(step, count, form)).toBe(expected)
  })
})

describe('pipAppearance', () => {
  test.each<{ status: StepStatus; owner: Owner; expected: string }>([
    { status: 'done', owner: 'agent', expected: 'done' },
    { status: 'done', owner: 'you', expected: 'done' },
    { status: 'pending', owner: 'agent', expected: 'pending' },
    { status: 'pending', owner: 'you', expected: 'pending' },
    { status: 'waiting', owner: 'agent', expected: 'waiting' },
    { status: 'waiting', owner: 'you', expected: 'waiting' },
    { status: 'running', owner: 'agent', expected: 'running' },
    { status: 'running', owner: 'you', expected: 'waiting' },
  ])('$owner, $status gives $expected', ({ status, owner, expected }) => {
    expect(pipAppearance(status, owner)).toBe(expected)
  })

  test("an agent's waiting step looks like it waits on you", () => {
    expect(pipAppearance('waiting', 'agent')).toBe('waiting')
  })

  test('your running step looks waiting, not running', () => {
    expect(pipAppearance('running', 'you')).toBe('waiting')
  })
})

describe('pipTitle', () => {
  test.each<{ owner: Owner; sessionName: string | null; title: string; expected: string }>([
    {
      owner: 'agent',
      sessionName: 'api-server',
      title: 'Draft the bus adapter',
      expected: 'api-server · Draft the bus adapter',
    },
    {
      owner: 'you',
      sessionName: null,
      title: 'Review the PR and merge',
      expected: 'user · Review the PR and merge',
    },
    {
      owner: 'agent',
      sessionName: null,
      title: 'Update call sites',
      expected: 'agent · Update call sites',
    },
  ])('gives "$expected"', ({ owner, sessionName, title, expected }) => {
    expect(pipTitle(owner, sessionName, title)).toBe(expected)
  })
})

describe('pipSummary', () => {
  const step = (owner: Owner, status: StepStatus): PipStep => ({ owner, status })

  test.each<{ name: string; steps: PipStep[]; expected: string }>([
    {
      name: 'the example from the content rules',
      steps: [
        step('agent', 'done'),
        step('agent', 'done'),
        step('you', 'waiting'),
        step('agent', 'pending'),
        step('you', 'pending'),
      ],
      expected: '5 steps: 2 done, 1 waiting on the user, 2 not started',
    },
    {
      name: 'a running agent is included',
      steps: [step('agent', 'done'), step('agent', 'running'), step('you', 'pending')],
      expected: '3 steps: 1 done, 1 running, 1 not started',
    },
    {
      name: 'every part',
      steps: [
        step('agent', 'done'),
        step('agent', 'running'),
        step('agent', 'waiting'),
        step('you', 'pending'),
      ],
      expected: '4 steps: 1 done, 1 running, 1 waiting on the user, 1 not started',
    },
    {
      name: 'only done steps',
      steps: [step('agent', 'done'), step('you', 'done')],
      expected: '2 steps: 2 done',
    },
    {
      name: 'only steps not started',
      steps: [step('agent', 'pending')],
      expected: '1 step: 1 not started',
    },
    {
      name: 'your running step counts as waiting on you',
      steps: [step('agent', 'done'), step('you', 'running')],
      expected: '2 steps: 1 done, 1 waiting on the user',
    },
  ])('$name', ({ steps, expected }) => {
    expect(pipSummary(steps)).toBe(expected)
  })

  test('leaves out every part whose count is zero', () => {
    const summary = pipSummary([step('agent', 'done'), step('agent', 'pending')])
    expect(summary).toBe('2 steps: 1 done, 1 not started')
    expect(summary).not.toContain('0')
    expect(summary).not.toContain('running')
    expect(summary).not.toContain('waiting')
  })
})

describe('stepStatusLabel', () => {
  test.each([
    {
      name: 'done with a duration',
      step: { status: 'done', durationSeconds: 9 * 60 },
      expected: 'Done · 9m',
    },
    { name: 'done with no duration', step: { status: 'done' }, expected: 'Done' },
    {
      name: 'done with a zero duration',
      step: { status: 'done', durationSeconds: 0 },
      expected: 'Done',
    },
    {
      name: 'done with a null duration',
      step: { status: 'done', durationSeconds: null },
      expected: 'Done',
    },
    {
      name: 'running',
      step: { status: 'running', startedAt: before(6 * 60 + 12) },
      expected: 'Running · 6m 12s',
    },
    {
      name: 'running, with time from earlier attempts',
      step: { status: 'running', startedAt: before(2 * 60), earlierSeconds: 4 * 60 + 12 },
      expected: 'Running · 6m 12s',
    },
    {
      name: 'waiting',
      step: { status: 'waiting', waitingSince: before(14 * 60 + 30) },
      expected: 'Waiting on user · 14m',
    },
    { name: 'pending', step: { status: 'pending' }, expected: 'Not started' },
  ] as const)('$name gives "$expected"', ({ step, expected }) => {
    expect(stepStatusLabel(step, NOW)).toBe(expected)
  })
})

describe('timelineAppearance', () => {
  test.each<{
    row: string
    status: StepStatus
    owner: Owner
    isCurrent: boolean
    expected: TimelineAppearance
  }>([
    { row: 'Done, agent', status: 'done', owner: 'agent', isCurrent: false, expected: 'done' },
    { row: 'Done, you', status: 'done', owner: 'you', isCurrent: false, expected: 'done' },
    {
      row: 'Current, agent, running',
      status: 'running',
      owner: 'agent',
      isCurrent: true,
      expected: 'current-agent-running',
    },
    {
      row: 'Current, agent, not yet picked up',
      status: 'pending',
      owner: 'agent',
      isCurrent: true,
      expected: 'current-agent-pending',
    },
    {
      row: 'Current, waiting on you, agent',
      status: 'waiting',
      owner: 'agent',
      isCurrent: true,
      expected: 'current-waiting',
    },
    {
      row: 'Current, waiting on you, you',
      status: 'waiting',
      owner: 'you',
      isCurrent: true,
      expected: 'current-waiting',
    },
    {
      row: 'Current, you, not waiting (pending)',
      status: 'pending',
      owner: 'you',
      isCurrent: true,
      expected: 'current-you-pending',
    },
    {
      row: 'Current, you, not waiting (running)',
      status: 'running',
      owner: 'you',
      isCurrent: true,
      expected: 'current-you-pending',
    },
    {
      row: 'Not started, not current, agent',
      status: 'pending',
      owner: 'agent',
      isCurrent: false,
      expected: 'pending',
    },
    {
      row: 'Not started, not current, you',
      status: 'pending',
      owner: 'you',
      isCurrent: false,
      expected: 'pending',
    },
  ])('$row gives $expected', ({ status, owner, isCurrent, expected }) => {
    expect(timelineAppearance(status, owner, isCurrent)).toBe(expected)
  })
})

describe('chainNote', () => {
  test.each([
    { steps: 3, yours: 1, expected: '3 steps · 1 for the user' },
    { steps: 1, yours: 0, expected: '1 step · 0 for the user' },
    { steps: 4, yours: 2, expected: '4 steps · 2 for the user' },
  ])('$steps and $yours gives "$expected"', ({ steps, yours, expected }) => {
    expect(chainNote(steps, yours)).toBe(expected)
  })
})
