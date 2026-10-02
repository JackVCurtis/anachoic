// Copied from anachoic tests/unit/shared/task_id.spec.ts at fd99e0d
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  formatTaskId,
  InvalidTaskIdError,
  parseTaskId,
  toTaskNumber,
} from '../../../shared/task_id.js'

describe('Task id', () => {
  test.each([1, 7, 90, 118, 999, 1000, 1204])('%i round trips', (id) => {
    expect(parseTaskId(formatTaskId(id))).toBe(id)
  })

  test('pads to three digits', () => {
    expect(formatTaskId(1)).toBe('T-001')
    expect(formatTaskId(7)).toBe('T-007')
    expect(formatTaskId(90)).toBe('T-090')
    expect(formatTaskId(118)).toBe('T-118')
    expect(formatTaskId(1204)).toBe('T-1204')
  })

  test('parses T-118 to 118', () => {
    expect(parseTaskId('T-118')).toBe(118)
    expect(parseTaskId('T-007')).toBe(7)
  })

  test.each([
    't-118',
    'T118',
    'T-',
    'T-0',
    'T-000',
    'T-abc',
    '118',
    'T-118x',
    ' T-118',
    'T-118 ',
    'T--1',
    'T-1.5',
    '',
  ])('refuses %j', (value) => {
    expect(() => parseTaskId(value)).toThrow(InvalidTaskIdError)
  })

  test('the refusal names the value it refused', () => {
    try {
      parseTaskId('t-118')
      expect.fail('expected an invalid task id')
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTaskIdError)
      expect((error as InvalidTaskIdError).value).toBe('t-118')
      expect((error as Error).message).toContain('T-118')
    }
  })

  test.each([0, -1, 1.5, Number.NaN])('formatting refuses %d, which no task is numbered', (id) => {
    expect(() => formatTaskId(id)).toThrow(RangeError)
  })

  test('it imports nothing at all', async () => {
    const source = await readFile(
      resolve(import.meta.dirname, '../../../shared/task_id.ts'),
      'utf8'
    )
    expect(source).not.toMatch(/\bimport\b|\brequire\(/)
  })
})

describe('toTaskNumber', () => {
  test.each([
    ['T-012', 12],
    ['T-12', 12],
    ['12', 12],
    [12, 12],
    ['T-1204', 1204],
  ])('accepts %j', (value, expected) => {
    expect(toTaskNumber(value)).toBe(expected)
  })

  test.each([0, -1, 1.5, 'T12', 't-12', '', '0', '-1', '1.5', ' 12', Number.NaN])(
    'refuses %j',
    (value) => {
      expect(() => toTaskNumber(value)).toThrow(InvalidTaskIdError)
    }
  )
})
