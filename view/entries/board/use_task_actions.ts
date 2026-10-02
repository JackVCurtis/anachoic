import { useState } from 'react'
import type { ActionResult, TaskRef } from '../../../shared/props'
import type { TaskSource } from '../../bridge/task_source'
import type { YourActions } from '../../bridge/wake'
import type { TaskAction } from '../../components/task/task_actions/task_actions'
import type { FailedWrite } from './use_board_messages'

export interface TaskActionHandlers {
  /** The fresh board an action returned. */
  onBoard?: (props: ActionResult) => void
  /** Archive succeeded: the task has left every list. */
  onArchived?: () => void
  onFailure: (failure: FailedWrite) => void
}

/**
 * Park and Archive from the task view: each calls its app-only tool, then
 * fetches the task again so the view shows where it now stands. Nothing is
 * posted to the chat. A refusal goes to onFailure.
 */
export function useTaskActions(
  yourActions: Pick<YourActions, 'moveToBacklog' | 'archiveTask'>,
  task: TaskRef,
  source: Pick<TaskSource, 'refresh'>,
  { onBoard, onArchived, onFailure }: TaskActionHandlers
) {
  const [pending, setPending] = useState<TaskAction | null>(null)

  async function run(action: TaskAction) {
    setPending(action)
    const outcome =
      action === 'park'
        ? await yourActions.moveToBacklog(task, true)
        : await yourActions.archiveTask(task)
    if (outcome.ok) {
      onBoard?.(outcome.props)
      await source.refresh()
    }
    setPending(null)
    if (!outcome.ok) {
      onFailure(outcome)
    } else if (action === 'archive') {
      onArchived?.()
    }
  }

  return {
    pending,
    onPark: () => void run('park'),
    onArchive: () => void run('archive'),
  }
}
