import type { BoardProps, TaskRef } from '../../shared/props.js'

const SEPARATOR = ' · '
const NONE = 'none'

function quoted(task: TaskRef) {
  return `${task.displayId} "${task.title}"`
}

function list(label: string, items: readonly string[]) {
  return `${label} (${items.length}): ${items.length === 0 ? NONE : items.join(SEPARATOR)}`
}

/**
 * The board as compact text for the model: a revision line, then one line
 * for each list with its count, and a line for the sessions.
 */
export function boardSummary(board: BoardProps): string {
  const sessions = board.sessions.map(({ name, live }) => (live ? `${name} (live)` : name))
  return [
    `Board, revision ${board.revision}`,
    list(
      'Your turn',
      board.yourTurn.map(
        ({ task, step }) => `${task.displayId} step ${step.number} "${step.title}"`
      )
    ),
    list(
      'Working',
      board.working.map(
        ({ task, step, session }) =>
          `${task.displayId} step ${step.number} "${step.title}" (${session.name})`
      )
    ),
    list(
      'Queue',
      board.queue.map(
        ({ task, position, nextOwner }) => `${position}. ${quoted(task)} next: ${nextOwner}`
      )
    ),
    list(
      'Backlog',
      board.backlog.map(({ task }) => task.displayId)
    ),
    list(
      'To sign off',
      board.toSignOff.map(({ task }) => quoted(task))
    ),
    `Sessions: ${sessions.length === 0 ? NONE : sessions.join(SEPARATOR)}`,
  ].join('\n')
}
