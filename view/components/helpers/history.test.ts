import { describe, expect, test } from 'vitest'
import { historySummary, pageLabel, stepCount, timesCell } from './history'

describe('the History view’s words', () => {
  test.each([
    { total: 0, expected: '0 completed tasks' },
    { total: 1, expected: '1 completed task' },
    { total: 38, expected: '38 completed tasks' },
  ])('historySummary($total) gives "$expected"', ({ total, expected }) => {
    expect(historySummary(total)).toBe(expected)
  })

  test('pageLabel gives "Page 2 of 3"', () => {
    expect(pageLabel(2, 3)).toBe('Page 2 of 3')
  })

  test('stepCount agrees with its number', () => {
    expect(stepCount(1)).toBe('1 step')
    expect(stepCount(4)).toBe('4 steps')
  })

  test('timesCell gives the agent’s time, then the user’s, with a dash for none', () => {
    expect(timesCell(14 * 60, 6 * 60)).toBe('14m / 6m')
    expect(timesCell(3600, 0)).toBe('1h / —')
  })
})
