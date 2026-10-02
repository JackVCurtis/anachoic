// Copied from anachoic inertia/components/helpers/task_drawer.test.ts at fd99e0d
import { describe, expect, test } from 'vitest'
import { badgeFor } from './task_view'

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
