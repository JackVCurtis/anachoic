// Copied from anachoic inertia/components/helpers/task_drawer.test.ts at fd99e0d
import { describe, expect, test } from 'vitest'
import { badgeFor, taskStepCounts, taskStepLabel } from './task_view'

describe('badgeFor', () => {
  test.each([
    { list: 'working', label: 'running', look: 'accent' },
    { list: 'yourTurn', label: 'waiting on user', look: 'accent' },
    { list: 'toSignOff', label: 'to sign off', look: 'accent' },
    { list: 'signedOff', label: 'done', look: 'accent' },
    { list: 'queue', label: 'queue', look: 'neutral' },
    { list: 'backlog', label: 'backlog', look: 'neutral' },
  ] as const)('$list gives "$label", $look', ({ list, label, look }) => {
    expect(badgeFor(list)).toEqual({ label, look })
  })
})

describe('taskStepLabel', () => {
  test.each([
    { done: false, current: 3, count: 5, label: 'Step 3 of 5' },
    { done: true, current: 3, count: 3, label: 'All 3 steps done' },
    { done: true, current: 1, count: 1, label: '1 step done' },
  ])('gives "$label"', ({ done, current, count, label }) => {
    expect(taskStepLabel(done, current, count)).toBe(label)
  })
})

describe('taskStepCounts', () => {
  test.each([
    { agent: 3, user: 2, line: '3 agent steps · 2 for the user' },
    { agent: 1, user: 0, line: '1 agent step · 0 for the user' },
  ])('gives "$line"', ({ agent, user, line }) => {
    expect(taskStepCounts(agent, user)).toBe(line)
  })
})
