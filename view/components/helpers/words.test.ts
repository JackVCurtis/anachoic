// Copied from anachoic inertia/components/helpers/words.test.ts at fd99e0d
import { describe, expect, test } from 'vitest'
import { joinFacts, padStep, plural, splitFacts } from './words'

describe('plural', () => {
  test.each([
    { count: 1, singular: 'task', expected: '1 task' },
    { count: 2, singular: 'task', expected: '2 tasks' },
    { count: 0, singular: 'step', expected: '0 steps' },
    { count: 0, singular: 'task', expected: '0 tasks' },
    { count: 1, singular: 'step', expected: '1 step' },
    { count: 2, singular: 'step', expected: '2 steps' },
    { count: 1, singular: 'agent step', expected: '1 agent step' },
    { count: 2, singular: 'agent step', expected: '2 agent steps' },
    { count: 1, singular: 'agent', expected: '1 agent' },
    { count: 2, singular: 'agent', expected: '2 agents' },
    { count: 1, singular: 'artifact', expected: '1 artifact' },
    { count: 2, singular: 'artifact', expected: '2 artifacts' },
    { count: 1, singular: 'file', expected: '1 file' },
    { count: 2, singular: 'file', expected: '2 files' },
    { count: 0, singular: 'agent', expected: '0 agents' },
    { count: 12, singular: 'file', expected: '12 files' },
  ])('$count, "$singular" gives "$expected"', ({ count, singular, expected }) => {
    expect(plural(count, singular)).toBe(expected)
  })

  test.each([
    { count: 0, expected: '0 people' },
    { count: 1, expected: '1 person' },
    { count: 2, expected: '2 people' },
  ])('$count with an irregular plural gives "$expected"', ({ count, expected }) => {
    expect(plural(count, 'person', 'people')).toBe(expected)
  })
})

describe('padStep', () => {
  test.each([
    { step: 1, expected: '01' },
    { step: 11, expected: '11' },
    { step: 0, expected: '00' },
    { step: 9, expected: '09' },
    { step: 10, expected: '10' },
    { step: 99, expected: '99' },
    { step: 100, expected: '100' },
  ])('$step gives "$expected"', ({ step, expected }) => {
    expect(padStep(step)).toBe(expected)
  })
})

describe('joinFacts', () => {
  test.each([
    { facts: ['core-api', '3 steps'], expected: 'core-api · 3 steps' },
    { facts: [], expected: '' },
    { facts: ['core-api'], expected: 'core-api' },
    { facts: ['core-api', '', '3 steps'], expected: 'core-api · 3 steps' },
    { facts: ['', 'core-api', ''], expected: 'core-api' },
    { facts: ['', ''], expected: '' },
    { facts: ['a', 'b', 'c'], expected: 'a · b · c' },
  ])('$facts gives "$expected"', ({ facts, expected }) => {
    expect(joinFacts(facts)).toBe(expected)
  })

  test('joins with U+00B7 and a space each side', () => {
    expect(joinFacts(['a', 'b'])).toBe('a · b')
    expect(joinFacts(['a', 'b']).codePointAt(2)).toBe(0xb7)
  })
})

describe('splitFacts', () => {
  test.each([
    { line: 'core-api · 3 steps', expected: ['core-api', '3 steps'] },
    { line: 'core-api', expected: ['core-api'] },
    { line: '', expected: [] },
    { line: 'a · b · c', expected: ['a', 'b', 'c'] },
    { line: '3 steps · agent 14m · you 6m', expected: ['3 steps', 'agent 14m', 'you 6m'] },
  ])('"$line" gives $expected', ({ line, expected }) => {
    expect(splitFacts(line)).toEqual(expected)
  })

  test('undoes joinFacts', () => {
    const facts = ['no repo', 'Research', '3 steps']

    expect(splitFacts(joinFacts(facts))).toEqual(facts)
  })
})
