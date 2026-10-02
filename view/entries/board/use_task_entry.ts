import { useState } from 'react'
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

/**
 * Task entry's draft, open state and submission, held by the board entry.
 * None of it outlives the view: a rebuild starts with an empty draft.
 * A refusal about one field is shown under it; any other goes to onRefusal.
 */
export function useTaskEntry(
  yourActions: Pick<YourActions, 'addTask'>,
  source: Pick<BoardSource, 'replace'>,
  onRefusal: (sentence: string) => void
): TaskEntryProps {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(emptyTaskEntryDraft)
  const [busy, setBusy] = useState<TaskEntryDestination | null>(null)
  const [fieldError, setFieldError] = useState<TaskEntryFieldError | null>(null)

  async function submit(destination: TaskEntryDestination) {
    setBusy(destination)
    setFieldError(null)
    const outcome = await yourActions.addTask({
      ...submittedTask(draft),
      queue: destination === 'queue',
    })
    setBusy(null)
    if (outcome.ok) {
      source.replace(outcome.props)
      setDraft(emptyTaskEntryDraft())
      setOpen(false)
      return
    }
    if (!('refusal' in outcome)) {
      return
    }
    const field = taskEntryFieldOf(outcome.refusal)
    if (field) {
      setFieldError({ field, text: outcome.refusal })
    } else {
      onRefusal(outcome.refusal)
    }
  }

  return {
    open,
    draft,
    busy,
    fieldError,
    onOpen: () => setOpen(true),
    onCancel: () => setOpen(false),
    onDraftChange: (next) => {
      setDraft(next)
      setFieldError(null)
    },
    onSubmit: (destination) => void submit(destination),
  }
}
