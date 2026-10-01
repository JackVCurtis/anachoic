// Copied from anachoic inertia/components/helpers/board_rail.test.ts at fd99e0d
import { describe, expect, test } from 'vitest'
import { moveAnnouncement, movedOrder, queuePosition } from './queue'
import { assistive } from './strings'

describe('queuePosition', () => {
  test.each([
    { position: 1, expected: '#1 in line' },
    { position: 12, expected: '#12 in line' },
  ])('$position gives "$expected"', ({ position, expected }) => {
    expect(queuePosition(position)).toBe(expected)
  })
})

describe('movedOrder', () => {
  const five = ['a', 'b', 'c', 'd', 'e']

  test.each([
    { lifted: 'c', move: 'up', expected: ['a', 'c', 'b', 'd', 'e'] },
    { lifted: 'c', move: 'down', expected: ['a', 'b', 'd', 'c', 'e'] },
    { lifted: 'c', move: 'first', expected: ['c', 'a', 'b', 'd', 'e'] },
    { lifted: 'c', move: 'last', expected: ['a', 'b', 'd', 'e', 'c'] },
    { lifted: 'e', move: 2, expected: ['a', 'e', 'b', 'c', 'd'] },
    { lifted: 'a', move: 4, expected: ['b', 'c', 'd', 'a', 'e'] },
    { lifted: 'c', move: 3, expected: ['a', 'b', 'c', 'd', 'e'] },
    { lifted: 'b', move: 0, expected: ['b', 'a', 'c', 'd', 'e'] },
    { lifted: 'b', move: 9, expected: ['a', 'c', 'd', 'e', 'b'] },
  ] as const)('$lifted moved $move', ({ lifted, move, expected }) => {
    expect(movedOrder(five, lifted, move)).toEqual(expected)
  })

  test('up at the front changes nothing', () => {
    expect(movedOrder(five, 'a', 'up')).toEqual(five)
  })

  test('down at the back changes nothing', () => {
    expect(movedOrder(five, 'e', 'down')).toEqual(five)
  })

  test.each(['up', 'down', 'first', 'last', 1, 2] as const)(
    'a list of one stays put: %s',
    (move) => {
      expect(movedOrder(['a'], 'a', move)).toEqual(['a'])
    }
  )

  test('a lifted id that is not in the list changes nothing', () => {
    expect(movedOrder(five, 'z', 'first')).toEqual(five)
  })

  test('the list given is not changed', () => {
    const ids = ['a', 'b', 'c']
    movedOrder(ids, 'c', 'first')
    expect(ids).toEqual(['a', 'b', 'c'])
  })
})

describe('moveAnnouncement', () => {
  test.each([
    {
      moment: 'lifted',
      position: 3,
      expected: '“Migrate billing webhooks” lifted. Position 3 of 5',
    },
    { moment: 'moved', position: 2, expected: 'Position 2 of 5' },
    {
      moment: 'dropped',
      position: 2,
      expected: '“Migrate billing webhooks” dropped at position 2 of 5',
    },
    {
      moment: 'cancelled',
      position: 3,
      expected: 'Move cancelled. “Migrate billing webhooks” is back at position 3 of 5',
    },
    {
      moment: 'left',
      position: 3,
      expected: '“Migrate billing webhooks” left the queue. Move ended',
    },
  ] as const)('$moment gives "$expected"', ({ moment, position, expected }) => {
    expect(moveAnnouncement(moment, 'Migrate billing webhooks', position, 5)).toBe(expected)
  })

  test('titles are wrapped in curly quotes, not straight ones', () => {
    for (const moment of ['lifted', 'dropped', 'cancelled', 'left'] as const) {
      const sentence = moveAnnouncement(moment, 'Fix', 1, 2)
      expect(sentence).toContain('“Fix”')
      expect(sentence).not.toContain('"')
    }
  })
})

describe('the Move handle instructions', () => {
  test('are in the catalogue', () => {
    expect(assistive.moveDescription).toBe(
      'Press Enter to lift. Use the arrow keys to move. Press Enter to drop, or Escape to cancel.'
    )
  })
})
