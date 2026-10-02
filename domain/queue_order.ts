// Copied from anachoic app/domain/queue_order.ts at fd99e0d
/**
 * The queue's order: each queued task's id mapped to its position, from 1.
 * Every function here returns a new order and leaves the one it was given alone.
 *
 * Where a task joins: added to the queue, or queued from the backlog, it joins
 * last. A task whose completed step is followed by an agent's step joins
 * first, so work under way finishes before new work starts, and so does a
 * task released by a dead session. A follow-up joins first or last, as asked.
 */
export type QueueOrder = ReadonlyMap<number, number>

export class QueueOrderError extends Error {
  name = 'QueueOrderError'
}

/**
 * True when the positions are exactly 1 to n, with no gap and no repeat.
 */
export function isContiguous(order: QueueOrder): boolean {
  const seen = new Set<number>()
  for (const position of order.values()) {
    if (!Number.isInteger(position) || position < 1 || position > order.size) return false
    if (seen.has(position)) return false
    seen.add(position)
  }
  return true
}

/**
 * The task ids from the front of the queue to the back.
 */
export function inLine(order: QueueOrder): number[] {
  return [...order.entries()].sort(([, a], [, b]) => a - b).map(([taskId]) => taskId)
}

function fromLine(line: readonly number[]): QueueOrder {
  return new Map(line.map((taskId, index) => [taskId, index + 1]))
}

function assertQueued(order: QueueOrder, taskId: number): void {
  if (!order.has(taskId)) {
    throw new QueueOrderError(`Task ${taskId} is not in the queue`)
  }
}

function assertNotQueued(order: QueueOrder, taskId: number): void {
  if (order.has(taskId)) {
    throw new QueueOrderError(`Task ${taskId} is already in the queue`)
  }
}

/**
 * The task takes the position after the last.
 */
export function joinBack(order: QueueOrder, taskId: number): QueueOrder {
  assertNotQueued(order, taskId)
  return fromLine([...inLine(order), taskId])
}

/**
 * The task takes position 1 and every other task moves down one.
 */
export function joinFront(order: QueueOrder, taskId: number): QueueOrder {
  assertNotQueued(order, taskId)
  return fromLine([taskId, ...inLine(order)])
}

/**
 * Where a task joins the queue, as add_follow_up and the transitions name it.
 */
export type Placement = 'first' | 'last'

export function join(order: QueueOrder, taskId: number, placement: Placement): QueueOrder {
  return placement === 'first' ? joinFront(order, taskId) : joinBack(order, taskId)
}

/**
 * The task takes the position it was dropped at. The tasks between its old
 * place and the new one shift one place, up or down. A position beyond the
 * end means the last place.
 */
export function move(order: QueueOrder, taskId: number, position: number): QueueOrder {
  assertQueued(order, taskId)
  if (!Number.isInteger(position) || position < 1) {
    throw new RangeError(`A queue position must be a whole number from 1, not ${position}`)
  }
  const line = inLine(order).filter((id) => id !== taskId)
  line.splice(Math.min(position, order.size) - 1, 0, taskId)
  return fromLine(line)
}

/**
 * The task's position is emptied and every task behind it moves up one.
 * Used for every way out of the queue: start, park, archive and the rest.
 */
export function leave(order: QueueOrder, taskId: number): QueueOrder {
  assertQueued(order, taskId)
  return fromLine(inLine(order).filter((id) => id !== taskId))
}
