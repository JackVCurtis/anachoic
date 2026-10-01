// Copied from anachoic inertia/components/helpers/messages.test.ts at fd99e0d
import { expect, test } from 'vitest'
import { flashWord } from './messages'

test.each([
  { kind: 'success', expected: 'Done' },
  { kind: 'error', expected: 'Error' },
] as const)('$kind begins "$expected"', ({ kind, expected }) => {
  expect(flashWord(kind)).toBe(expected)
})
