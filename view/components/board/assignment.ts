import { card, fillTemplate } from '../helpers/strings'
import type { BoardTask } from './board_data'

/**
 * "Assigned to api-server" for a task assigned to a worker, else empty, which
 * a meta line leaves out.
 */
export function assignmentFact(task: BoardTask): string {
  return task.assignedTo ? fillTemplate(card.assignedTo, { name: task.assignedTo.name }) : ''
}
