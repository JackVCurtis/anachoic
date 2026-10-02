import { useState } from 'react'
import type { Worker } from '../../../shared/props'
import type { BoardSource } from '../../bridge/board_source'
import type { YourActions } from '../../bridge/wake'
import type {
  TaskEntryDestination,
  TaskEntryProps,
} from '../../components/board/task_entry/task_entry'
import {
  emptyTaskEntryDraft,
  submittedTask,
  type TaskEntryFieldError,
} from '../../components/helpers/task_entry'
import { taskEntryFieldOf } from './task_entry_refusal'
import type { FailedWrite } from './use_board_messages'

/**
 * Task entry's draft, open state and submission, held by the board entry.
 * None of it outlives the view: a rebuild starts with an empty draft.
 * The worker field lists the live workers of the latest board, so a worker
 * that ends drops out and the field falls back to "Any worker".
 * A refusal about one field is shown under it; any other failure goes to
 * onFailure.
 */
export function useTaskEntry(
  yourActions: Pick<YourActions, 'addTask'>,
  source: Pick<BoardSource, 'replace'>,
  onFailure: (failure: FailedWrite) => void,
  workers: readonly Worker[] = []
): TaskEntryProps {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(emptyTaskEntryDraft)
  const [busy, setBusy] = useState<TaskEntryDestination | null>(null)
  const [fieldError, setFieldError] = useState<TaskEntryFieldError | null>(null)

  async function submit(destination: TaskEntryDestination) {
    setBusy(destination)
    setFieldError(null)
    const outcome = await yourActions.addTask({
      ...submittedTask(draft, workers),
      queue: destination === 'queue',
    })
    setBusy(null)
    if (outcome.ok) {
      source.replace(outcome.props)
      setDraft(emptyTaskEntryDraft())
      setOpen(false)
      return
    }
    const field = 'refusal' in outcome ? taskEntryFieldOf(outcome.refusal) : null
    if (field && 'refusal' in outcome) {
      setFieldError({ field, text: outcome.refusal })
    } else {
      onFailure(outcome)
    }
  }

  return {
    open,
    draft,
    busy,
    fieldError,
    workers,
    onOpen: () => setOpen(true),
    onCancel: () => setOpen(false),
    onDraftChange: (next) => {
      setDraft(next)
      setFieldError(null)
    },
    onSubmit: (destination) => void submit(destination),
  }
}
