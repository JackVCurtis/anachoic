import { join, leave, move, type QueueOrder } from './queue_order.js'
import type { QueueEffect } from './transitions.js'

/**
 * The queue's order after a transition's queue effect on one task.
 */
export function applyQueueEffect(
  order: QueueOrder,
  taskId: number,
  effect: QueueEffect
): QueueOrder {
  switch (effect.kind) {
    case 'none':
      return order
    case 'join':
      return join(order, taskId, effect.placement)
    case 'move':
      return move(order, taskId, effect.position)
    case 'leave':
      return leave(order, taskId)
  }
}
