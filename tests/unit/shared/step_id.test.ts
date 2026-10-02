import { describe, expect, test } from 'vitest'
import { InvalidStepIdError, parseStepId, stepId } from '../../../shared/step_id.js'

describe('Step id', () => {
  test.each([
    [1, 1],
    [12, 2],
    [118, 20],
    [1204, 37],
  ])('task %i step %i round trips', (taskNumber, stepNumber) => {
    expect(parseStepId(stepId(taskNumber, stepNumber))).toEqual({ taskNumber, stepNumber })
  })

  test('is the task number and the step number', () => {
    expect(stepId(12, 2)).toBe('12.2')
  })

  test.each(['', '12', '12.', '.2', '12.0', '0.2', '012.2', '12.2.1', 'T-012.2', '12-2', ' 12.2'])(
    'refuses %j',
    (value) => {
      expect(() => parseStepId(value)).toThrow(InvalidStepIdError)
    }
  )

  test.each([
    [0, 1],
    [1, 0],
    [1.5, 1],
    [1, -1],
  ])('refuses to make an id from task %d step %d', (taskNumber, stepNumber) => {
    expect(() => stepId(taskNumber, stepNumber)).toThrow(RangeError)
  })
})
