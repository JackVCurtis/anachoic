import { expect, test } from 'vitest'
import { NAMED_BOARDS } from '../fixtures/board'
import type { BoardData } from './board_data'

test('every named board fixture is a BoardData', () => {
  const boards: Record<keyof typeof NAMED_BOARDS, BoardData> = NAMED_BOARDS
  expect(Object.keys(boards)).toEqual([
    'EMPTY_BOARD',
    'BUSY_BOARD',
    'MANY_BOARD',
    'LONG_TEXT_BOARD',
  ])
})
