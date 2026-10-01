import { describe, expect, test } from 'vitest'
import { emptyBoard } from '../../server/props/empty_board.js'
import { boardSummary } from '../../server/text/board_summary.js'
import { boardPropsSchema } from '../../shared/props.js'

describe('the empty board', () => {
  test('is at revision 0 with every list empty and every count 0, and parses as board props', () => {
    const board = emptyBoard(new Date('2026-10-01T12:00:00Z'))

    expect(boardPropsSchema.parse(board)).toEqual({
      revision: 0,
      now: '2026-10-01T12:00:00.000Z',
      yourTurn: [],
      working: [],
      queue: [],
      backlog: [],
      toSignOff: [],
      signedOff: [],
      sessions: [],
      counts: { yourTurn: 0, working: 0, queue: 0, toSignOff: 0 },
    })
  })

  test('is summarised as its revision and each list with a count of 0', () => {
    expect(boardSummary(emptyBoard())).toBe(
      [
        'Board, revision 0',
        'Your turn (0): none',
        'Working (0): none',
        'Queue (0): none',
        'Backlog (0): none',
        'To sign off (0): none',
        'Sessions: none',
      ].join('\n')
    )
  })
})
