import type { DatabaseSync } from 'node:sqlite'
import { isRefusal } from '../../../domain/refusal.js'
import { addToQueue, type Context, type Outcome } from '../../../domain/transitions.js'
import type { Owner, TaskState } from '../../../domain/types.js'
import type { Database } from '../../../store/database.js'
import { read } from '../../../store/read.js'
import { applyChange, loadTaskState, stepFromRow, taskFromRow } from '../../../store/rows.js'
import { isWritten, write } from '../../../store/write.js'

/**
 * Every task with its chain, as the invariant checks take them.
 */
export function allTaskStates(sqlite: DatabaseSync): TaskState[] {
  const steps = sqlite
    .prepare('SELECT * FROM steps ORDER BY task_id, number')
    .all()
    .map(stepFromRow)
  return sqlite
    .prepare('SELECT * FROM tasks ORDER BY id')
    .all()
    .map(taskFromRow)
    .map((task) => ({ task, steps: steps.filter((step) => step.taskId === task.id) }))
}

export function boardRevision(database: Database): number {
  return read(
    database,
    (sqlite) =>
      (sqlite.prepare('SELECT revision FROM board').get() as { revision: number }).revision
  )
}

/**
 * Adds a task straight to the queue with the domain's rules, numbering it
 * from the board as the services do.
 */
export function addQueuedTask(database: Database, owners: Owner[], ctx: Context): number {
  const result = write(database, (sqlite) => {
    const { next_task_number: taskId } = sqlite
      .prepare('SELECT next_task_number FROM board')
      .get() as {
      next_task_number: number
    }
    sqlite.prepare('UPDATE board SET next_task_number = next_task_number + 1').run()
    applyChange(
      sqlite,
      addToQueue(
        {
          taskId,
          title: `Task ${taskId}`,
          steps: owners.map((owner, index) => ({ title: `Step ${index + 1}`, owner })),
        },
        ctx
      )
    )
    return taskId
  })
  if (!isWritten(result)) throw new Error(result.sentence)
  return result.value
}

/**
 * Applies one transition to a stored task, failing on a refusal.
 */
export function transition(
  database: Database,
  taskId: number,
  apply: (state: TaskState) => Outcome
) {
  const result = write(database, (sqlite) => {
    const outcome = apply(loadTaskState(sqlite, taskId)!)
    if (isRefusal(outcome)) return outcome
    return applyChange(sqlite, outcome)
  })
  if (!isWritten(result)) throw new Error(result.sentence)
  return result
}
