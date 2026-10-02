import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { assistive, taskEntry } from '../../helpers/strings'
import {
  TASK_ENTRY_LIMITS,
  taskEntryMissing,
  type TaskEntryDraft,
  type TaskEntryFieldError,
} from '../../helpers/task_entry'
import { SectionHeader } from '../../patterns/section_header/section_header'
import { Button } from '../../primitives/button/button'
import { Frame } from '../../primitives/frame/frame'
import { TextInput } from '../../primitives/text_input/text_input'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import { ChainComposer, errorFor, FieldError } from '../chain_composer/chain_composer'
import styles from './task_entry.module.css'

export type TaskEntryDestination = 'backlog' | 'queue'

export interface TaskEntryProps {
  /** Collapsed, it is a single "Add task" button. */
  open: boolean
  draft: TaskEntryDraft
  /** Where the task in flight is being added, or null when none is. */
  busy?: TaskEntryDestination | null
  /** A message from the server about one of the fields. */
  fieldError?: TaskEntryFieldError | null
  onOpen: () => void
  /** "Cancel" or Escape. */
  onCancel: () => void
  onDraftChange: (draft: TaskEntryDraft) => void
  onSubmit: (destination: TaskEntryDestination) => void
}

/** Enter while an input method composes a character is the composer's, not ours. */
function isComposing(event: KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229
}

/**
 * Adds a task: collapsed to "Add task" until opened, then a title and a chain
 * of steps, each with an owner and an optional detail, with "Add to queue"
 * and "Add". The draft belongs to the parent.
 */
export function TaskEntry({
  open,
  draft,
  busy = null,
  fieldError = null,
  onOpen,
  onCancel,
  onDraftChange,
  onSubmit,
}: TaskEntryProps) {
  const openButton = useRef<HTMLButtonElement>(null)
  /** Set when the form closes while it holds focus, so focus goes back to "Add task". */
  const refocus = useRef(false)

  useLayoutEffect(() => {
    if (!open && refocus.current) {
      refocus.current = false
      openButton.current?.focus()
    }
  }, [open])

  if (!open) {
    return (
      <Button ref={openButton} variant="secondary" icon="plus" onPress={onOpen}>
        {taskEntry.addTask}
      </Button>
    )
  }

  return (
    <TaskEntryForm
      draft={draft}
      busy={busy}
      fieldError={fieldError}
      onCancel={onCancel}
      onDraftChange={onDraftChange}
      onSubmit={onSubmit}
      onClosing={(heldFocus) => {
        refocus.current = heldFocus
      }}
    />
  )
}

interface TaskEntryFormProps extends Omit<TaskEntryProps, 'open' | 'onOpen'> {
  busy: TaskEntryDestination | null
  fieldError: TaskEntryFieldError | null
  /** Told, as the form goes, whether it held focus. */
  onClosing: (heldFocus: boolean) => void
}

function TaskEntryForm({
  draft,
  busy,
  fieldError,
  onCancel,
  onDraftChange,
  onSubmit,
  onClosing,
}: TaskEntryFormProps) {
  const headingId = useId()
  const hintId = useId()
  const titleErrorId = useId()
  const form = useRef<HTMLFormElement>(null)
  const title = useRef<HTMLInputElement>(null)

  const missing = taskEntryMissing(draft)
  const titleError = errorFor(fieldError, { kind: 'title' })

  useEffect(() => {
    title.current?.focus()
  }, [])

  const closing = useRef(onClosing)
  useLayoutEffect(() => {
    closing.current = onClosing
  })

  /* The DOM is still attached while a layout effect's cleanup runs, so focus can be read. */
  useLayoutEffect(() => {
    const element = form.current
    return () => closing.current(element?.contains(document.activeElement) ?? false)
  }, [])

  function submit(destination: TaskEntryDestination) {
    if (missing === null && busy === null) {
      onSubmit(destination)
    }
  }

  function handleTitleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    if (!isComposing(event)) {
      submit(event.shiftKey ? 'queue' : 'backlog')
    }
  }

  function handleFormKey(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape' && busy === null) {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <Frame className={styles.form}>
      <form
        ref={form}
        aria-labelledby={headingId}
        noValidate
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={handleFormKey}
        className={styles.column}
      >
        <SectionHeader
          headingLevel={2}
          headingId={headingId}
          title={taskEntry.title}
          trailing={
            <Button variant="ghost" size="sm" disabled={busy !== null} onPress={onCancel}>
              {taskEntry.cancel}
            </Button>
          }
        />
        <div className={styles.field}>
          <TextInput
            ref={title}
            labelledBy={headingId}
            value={draft.title}
            placeholder={taskEntry.titlePlaceholder}
            invalid={titleError !== null}
            describedBy={titleError !== null ? titleErrorId : hintId}
            onChange={(text) =>
              onDraftChange({ ...draft, title: text.slice(0, TASK_ENTRY_LIMITS.title) })
            }
            onKeyDown={handleTitleKey}
          />
          {titleError !== null && <FieldError id={titleErrorId} text={titleError} />}
        </div>
        <ChainComposer
          steps={draft.steps}
          fieldError={fieldError}
          onChange={(steps) => onDraftChange({ ...draft, steps })}
        />
        <div className={styles.submitRow}>
          <Button
            variant="primary"
            busy={busy === 'queue'}
            disabled={busy === 'backlog' || (missing !== null && busy === null)}
            onPress={() => submit('queue')}
          >
            {taskEntry.addToQueue}
          </Button>
          <Button
            variant="secondary"
            busy={busy === 'backlog'}
            disabled={busy === 'queue' || (missing !== null && busy === null)}
            onPress={() => submit('backlog')}
          >
            {taskEntry.add}
          </Button>
          <p id={hintId} aria-live="polite" className={joinClasses('text-hint', styles.hint)}>
            {fieldError === null &&
              (missing ?? (
                <>
                  <span aria-hidden="true">{taskEntry.hint}</span>
                  <VisuallyHidden>{assistive.entryHint}</VisuallyHidden>
                </>
              ))}
          </p>
        </div>
      </form>
    </Frame>
  )
}
