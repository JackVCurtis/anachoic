// Copied from anachoic inertia/components/helpers/board_rail.ts at fd99e0d
import { assistive, fillTemplate, queue } from './strings'

/**
 * A Queue card's position label: "#1 in line".
 */
export function queuePosition(position: number): string {
  return fillTemplate(queue.position, { n: position })
}

/**
 * A move of a lifted Queue card: one place up or down, to the front or the
 * back, or to a place counted from 1.
 */
export type QueueMove = 'up' | 'down' | 'first' | 'last' | number

/**
 * The task ids in their new order after the lifted card makes a move. The
 * order is the Queue's only ranking. A move past either end stops there, and
 * a lifted id that is not in the list changes nothing.
 */
export function movedOrder(ids: readonly string[], liftedId: string, move: QueueMove): string[] {
  const from = ids.indexOf(liftedId)
  if (from === -1) {
    return [...ids]
  }

  const last = ids.length - 1
  let to: number
  switch (move) {
    case 'up':
      to = from - 1
      break
    case 'down':
      to = from + 1
      break
    case 'first':
      to = 0
      break
    case 'last':
      to = last
      break
    default:
      to = move - 1
  }
  to = Math.min(Math.max(to, 0), last)

  const rest = ids.filter((_, index) => index !== from)
  return [...rest.slice(0, to), liftedId, ...rest.slice(to)]
}

/**
 * A moment in the move of a Queue card. `left` means the lifted card's task
 * left the Queue during the move.
 */
export type MoveMoment = 'lifted' | 'moved' | 'dropped' | 'cancelled' | 'left'

/**
 * One sentence for the Queue's live region. `position` counts from 1 and
 * `count` is the number of tasks in the Queue.
 */
export function moveAnnouncement(
  moment: MoveMoment,
  title: string,
  position: number,
  count: number
): string {
  switch (moment) {
    case 'lifted':
      return fillTemplate(assistive.moveLifted, { title, n: position, m: count })
    case 'moved':
      return fillTemplate(assistive.moveMoved, { n: position, m: count })
    case 'dropped':
      return fillTemplate(assistive.moveDropped, { title, n: position, m: count })
    case 'cancelled':
      return fillTemplate(assistive.moveCancelled, { title, n: position, m: count })
    case 'left':
      return fillTemplate(assistive.moveLeftQueue, { title })
  }
}
