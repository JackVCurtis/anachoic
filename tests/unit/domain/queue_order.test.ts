// Copied from anachoic tests/unit/domain/queue_order.spec.ts at fd99e0d
import { describe, expect, test } from 'vitest'
import { applyQueueEffect } from '../../../domain/queue_effect.js'
import {
  type QueueOrder,
  QueueOrderError,
  inLine,
  isContiguous,
  join,
  joinBack,
  joinFront,
  leave,
  move,
} from '../../../domain/queue_order.js'

function queueOf(...taskIds: number[]): QueueOrder {
  return new Map(taskIds.map((taskId, index) => [taskId, index + 1]))
}

function asObject(order: QueueOrder): Record<number, number> {
  return Object.fromEntries(order)
}

describe('Queue order / joining', () => {
  test('a task joining at the back takes the position after the last', () => {
    const order = joinBack(queueOf(10, 20, 30), 40)
    expect(asObject(order)).toEqual({ 10: 1, 20: 2, 30: 3, 40: 4 })
  })

  test('a task joining an empty queue at the back takes position 1', () => {
    expect(asObject(joinBack(queueOf(), 40))).toEqual({ 40: 1 })
  })

  test('a task joining at the front takes position 1 and the rest move down one', () => {
    const order = joinFront(queueOf(10, 20, 30), 40)
    expect(asObject(order)).toEqual({ 40: 1, 10: 2, 20: 3, 30: 4 })
  })

  test('a task joining an empty queue at the front takes position 1', () => {
    expect(asObject(joinFront(queueOf(), 40))).toEqual({ 40: 1 })
  })

  test.each([
    { where: 'back', joining: joinBack },
    { where: 'front', joining: joinFront },
  ])('a task already in the queue cannot join it again at the $where', ({ joining }) => {
    expect(() => joining(queueOf(10, 20), 20)).toThrow(QueueOrderError)
  })

  test('the order given is left unchanged', () => {
    const order = queueOf(10, 20, 30)
    joinBack(order, 40)
    joinFront(order, 50)
    move(order, 30, 1)
    leave(order, 10)
    expect(asObject(order)).toEqual({ 10: 1, 20: 2, 30: 3 })
  })
})

describe('Queue order / join with a placement', () => {
  test.each([
    { placement: 'first' as const, same: joinFront },
    { placement: 'last' as const, same: joinBack },
  ])('$placement matches its join', ({ placement, same }) => {
    for (const start of [queueOf(), queueOf(10), queueOf(10, 20, 30)]) {
      expect(asObject(join(start, 40, placement))).toEqual(asObject(same(start, 40)))
    }
  })

  test.each(['first', 'last'] as const)('%s refuses a task already queued', (placement) => {
    expect(() => join(queueOf(10, 20), 10, placement)).toThrow(QueueOrderError)
  })
})

describe('Queue order / moving', () => {
  test('moving a task up shifts the tasks between down one', () => {
    const order = move(queueOf(10, 20, 30, 40, 50), 40, 2)
    expect(inLine(order)).toEqual([10, 40, 20, 30, 50])
    expect(asObject(order)).toEqual({ 10: 1, 40: 2, 20: 3, 30: 4, 50: 5 })
  })

  test('moving a task down shifts the tasks between up one', () => {
    const order = move(queueOf(10, 20, 30, 40, 50), 20, 4)
    expect(inLine(order)).toEqual([10, 30, 40, 20, 50])
    expect(asObject(order)).toEqual({ 10: 1, 30: 2, 40: 3, 20: 4, 50: 5 })
  })

  test('moving a task to its own place changes nothing', () => {
    const order = move(queueOf(10, 20, 30), 20, 2)
    expect(asObject(order)).toEqual({ 10: 1, 20: 2, 30: 3 })
  })

  test.each([{ position: 4 }, { position: 99 }])(
    'moving a task to position $position, beyond the end, puts it last',
    ({ position }) => {
      const order = move(queueOf(10, 20, 30), 10, position)
      expect(asObject(order)).toEqual({ 20: 1, 30: 2, 10: 3 })
    }
  )

  test('moving a task to the front', () => {
    const order = move(queueOf(10, 20, 30), 30, 1)
    expect(asObject(order)).toEqual({ 30: 1, 10: 2, 20: 3 })
  })

  test('a task not in the queue cannot be moved', () => {
    expect(() => move(queueOf(10, 20), 30, 1)).toThrow(QueueOrderError)
  })

  test.each([{ position: 0 }, { position: -1 }, { position: 1.5 }, { position: Number.NaN }])(
    'position $position is refused',
    ({ position }) => {
      expect(() => move(queueOf(10, 20), 10, position)).toThrow(RangeError)
    }
  )
})

describe('Queue order / leaving', () => {
  test('leaving from the front moves every task up one', () => {
    const order = leave(queueOf(10, 20, 30), 10)
    expect(asObject(order)).toEqual({ 20: 1, 30: 2 })
  })

  test('leaving from the middle moves the tasks behind up one', () => {
    const order = leave(queueOf(10, 20, 30), 20)
    expect(asObject(order)).toEqual({ 10: 1, 30: 2 })
  })

  test('leaving from the back moves nothing', () => {
    const order = leave(queueOf(10, 20, 30), 30)
    expect(asObject(order)).toEqual({ 10: 1, 20: 2 })
  })

  test('the only task leaving empties the queue', () => {
    expect(leave(queueOf(10), 10).size).toBe(0)
  })

  test('a task not in the queue cannot leave it', () => {
    expect(() => leave(queueOf(10, 20), 30)).toThrow(QueueOrderError)
  })
})

describe('Queue order / contiguity', () => {
  test.each([
    { label: 'an empty queue', positions: [] },
    { label: 'one task at 1', positions: [1] },
    { label: '1 to 4 in any order', positions: [3, 1, 4, 2] },
  ])('$label is contiguous', ({ positions }) => {
    expect(isContiguous(new Map(positions.map((position, index) => [index, position])))).toBe(true)
  })

  test.each([
    { label: 'a gap', positions: [1, 3] },
    { label: 'a repeat', positions: [1, 2, 2] },
    { label: 'starting at 0', positions: [0, 1] },
    { label: 'starting at 2', positions: [2, 3] },
    { label: 'a fraction', positions: [1, 1.5] },
    { label: 'a negative', positions: [-1, 1] },
  ])('$label is not contiguous', ({ positions }) => {
    expect(isContiguous(new Map(positions.map((position, index) => [index, position])))).toBe(false)
  })
})

/**
 * Mulberry32: a small seeded generator, so a failing run can be repeated.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

describe('Queue order / any sequence of operations', () => {
  test.each([1, 2, 3, 42, 1234, 99_999])('positions stay exactly 1 to n with seed %i', (seed) => {
    const random = seededRandom(seed)
    const pick = (count: number) => Math.floor(random() * count)

    const startSize = pick(8)
    let order = queueOf(...Array.from({ length: startSize }, (_, index) => index + 1))
    let nextTaskId = startSize + 1
    const applied: string[] = []

    for (let step = 0; step < 500; step++) {
      const line = inLine(order)
      const operation = line.length === 0 ? pick(2) : pick(5)
      if (operation === 0) {
        applied.push(`joinBack(${nextTaskId})`)
        order = joinBack(order, nextTaskId++)
      } else if (operation === 1) {
        applied.push(`joinFront(${nextTaskId})`)
        order = joinFront(order, nextTaskId++)
      } else if (operation === 2) {
        const taskId = line[pick(line.length)]
        const position = 1 + pick(line.length + 3)
        applied.push(`move(${taskId}, ${position})`)
        order = move(order, taskId, position)
      } else if (operation === 3) {
        const taskId = line[pick(line.length)]
        applied.push(`leave(${taskId})`)
        order = leave(order, taskId)
      } else {
        const placement = pick(2) === 0 ? 'first' : 'last'
        applied.push(`join(${nextTaskId}, ${placement})`)
        order = join(order, nextTaskId++, placement)
      }

      const positions = [...order.values()].sort((a, b) => a - b)
      const expected = Array.from({ length: order.size }, (_, index) => index + 1)
      expect(
        positions,
        `Seed ${seed}, start size ${startSize}, after: ${applied.join(', ')}`
      ).toEqual(expected)
      expect(isContiguous(order)).toBe(true)
    }
  })
})

describe('Queue effects', () => {
  test('apply each kind of effect', () => {
    const order = queueOf(10, 20)
    expect(applyQueueEffect(order, 30, { kind: 'none' })).toBe(order)
    expect(inLine(applyQueueEffect(order, 30, { kind: 'join', placement: 'first' }))).toEqual([
      30, 10, 20,
    ])
    expect(inLine(applyQueueEffect(order, 30, { kind: 'join', placement: 'last' }))).toEqual([
      10, 20, 30,
    ])
    expect(inLine(applyQueueEffect(order, 20, { kind: 'move', position: 1 }))).toEqual([20, 10])
    expect(inLine(applyQueueEffect(order, 10, { kind: 'leave' }))).toEqual([20])
  })
})
