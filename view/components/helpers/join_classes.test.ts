// Copied from anachoic inertia/components/helpers/join_classes.test.ts at fd99e0d
import { describe, expect, test } from 'vitest'
import { joinClasses } from './join_classes'

describe('joinClasses', () => {
  test.each([
    { classes: [], expected: '' },
    { classes: ['card'], expected: 'card' },
    { classes: ['card', 'selected'], expected: 'card selected' },
    { classes: ['selected', 'card'], expected: 'selected card' },
    { classes: ['card', false, 'selected'], expected: 'card selected' },
    { classes: [null, 'card', undefined], expected: 'card' },
    { classes: ['', 'card', 0, 'busy'], expected: 'card busy' },
    { classes: [false, null, undefined, '', 0], expected: '' },
    { classes: ['a', false, 'b', null, 'c', undefined, 'd'], expected: 'a b c d' },
  ] as const)('$classes gives "$expected"', ({ classes, expected }) => {
    expect(joinClasses(...classes)).toBe(expected)
  })
})
