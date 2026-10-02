// Copied from anachoic inertia/components/fixtures/fixtures.test.ts at fd99e0d
import { describe, expect, test } from 'vitest'
import { NAMED_BOARDS, type BoardSample } from './board'
import { FIXED_NOW } from './clock'
import { LONG_TEXT } from './long_text'

describe('long text', () => {
  test('each field is at its longest', () => {
    expect(LONG_TEXT.title).toHaveLength(120)
    expect(LONG_TEXT.name).toHaveLength(40)
    expect(LONG_TEXT.message).toHaveLength(200)
    expect(LONG_TEXT.answer).toHaveLength(4000)
  })
})

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

/**
 * Every string in a value that reads as an ISO 8601 instant.
 */
function instantsIn(value: unknown): string[] {
  if (typeof value === 'string') return ISO_INSTANT.test(value) ? [value] : []
  if (Array.isArray(value)) return value.flatMap(instantsIn)
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(instantsIn)
  return []
}

function displayIdsOf(board: BoardSample): string[] {
  return [
    ...board.yourTurn,
    ...board.working,
    ...board.queue,
    ...board.backlog,
    ...board.toSignOff,
    ...board.signedOff,
  ].map(({ task }) => task.displayId)
}

describe('the board fixtures', () => {
  const boards = Object.entries(NAMED_BOARDS)

  test.each(boards)('%s has every time at or before FIXED_NOW', (_name, board) => {
    for (const instant of instantsIn(board)) {
      expect(Date.parse(instant)).toBeLessThanOrEqual(Date.parse(FIXED_NOW))
    }
  })

  test('the busy board has times to check', () => {
    expect(instantsIn(NAMED_BOARDS.BUSY_BOARD)).toHaveLength(15)
  })

  test.each(boards)('%s has each display id once', (_name, board) => {
    const ids = displayIdsOf(board)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
