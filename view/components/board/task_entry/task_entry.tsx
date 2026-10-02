import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { assistive, fillTemplate, taskEntry } from '../../helpers/strings'
import {
  TASK_ENTRY_LIMITS,
  newTaskEntryStep,
  taskEntryMissing,
  type TaskEntryDraft,
  type TaskEntryField,
  type TaskEntryFieldError,
  type TaskEntryStep,
} from '../../helpers/task_entry'
import { padStep } from '../../helpers/words'
import { SectionHeader } from '../../patterns/section_header/section_header'
import { Button } from '../../primitives/button/button'
import { Frame } from '../../primitives/frame/frame'
import { IconButton } from '../../primitives/icon_button/icon_button'
import { TextArea } from '../../primitives/text_area/text_area'
import { TextInput } from '../../primitives/text_input/text_input'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import type { Owner } from '../../types'
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

const REMOVE_GLYPH = '×'

function sameField(a: TaskEntryField, b: TaskEntryField): boolean {
  return a.kind === b.kind && ('index' in a ? 'index' in b && a.index === b.index : true)
}

function errorFor(fieldError: TaskEntryFieldError | null | undefined, field: TaskEntryField) {
  return fieldError && sameField(fieldError.field, field) ? fieldError.text : null
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
  const stepsErrorId = useId()
  const form = useRef<HTMLFormElement>(null)
  const title = useRef<HTMLInputElement>(null)
  /** The step whose title takes focus once it is drawn. */
  const focusStep = useRef<string | null>(null)

  const missing = taskEntryMissing(draft)
  const titleError = errorFor(fieldError, { kind: 'title' })
  const stepsError = errorFor(fieldError, { kind: 'steps' })

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

  useEffect(() => {
    if (focusStep.current !== null) {
      form.current
        ?.querySelector<HTMLInputElement>(`[data-step="${focusStep.current}"] input[type="text"]`)
        ?.focus()
      focusStep.current = null
    }
  })

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

  function changeStep(index: number, change: Partial<TaskEntryStep>) {
    onDraftChange({
      ...draft,
      steps: draft.steps.map((step, at) => (at === index ? { ...step, ...change } : step)),
    })
  }

  function addStep() {
    const step = newTaskEntryStep()
    onDraftChange({ ...draft, steps: [...draft.steps, step] })
    focusStep.current = step.id
  }

  function removeStep(index: number) {
    const steps = draft.steps.filter((_, at) => at !== index)
    onDraftChange({ ...draft, steps })
    focusStep.current = steps[Math.min(index, steps.length - 1)]?.id ?? null
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
        <div className={styles.field}>
          <VisuallyHidden element="span" id={`${headingId}-steps`}>
            {taskEntry.stepsLabel}
          </VisuallyHidden>
          <ol aria-labelledby={`${headingId}-steps`} className={styles.steps}>
            {draft.steps.map((step, index) => (
              <StepRow
                key={step.id}
                step={step}
                index={index}
                removable={draft.steps.length > 1}
                fieldError={fieldError}
                onChange={(change) => changeStep(index, change)}
                onRemove={() => removeStep(index)}
              />
            ))}
          </ol>
          {stepsError !== null && <FieldError id={stepsErrorId} text={stepsError} />}
          {draft.steps.length < TASK_ENTRY_LIMITS.steps && (
            <Button
              variant="utility"
              size="sm"
              icon="plus"
              onPress={addStep}
              className={styles.addStep}
            >
              {taskEntry.addStep}
            </Button>
          )}
        </div>
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

function FieldError({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className={joinClasses('text-hint', styles.error)}>
      {text}
    </p>
  )
}

interface StepRowProps {
  step: TaskEntryStep
  index: number
  removable: boolean
  fieldError: TaskEntryFieldError | null
  onChange: (change: Partial<TaskEntryStep>) => void
  onRemove: () => void
}

const OWNERS: ReadonlyArray<{ owner: Owner; label: string }> = [
  { owner: 'agent', label: taskEntry.ownerAgent },
  { owner: 'you', label: taskEntry.ownerYou },
]

function StepRow({ step, index, removable, fieldError, onChange, onRemove }: StepRowProps) {
  const groupName = useId()
  const titleErrorId = useId()
  const detailErrorId = useId()
  const detailField = useRef<HTMLTextAreaElement>(null)
  const [detailAsked, setDetailAsked] = useState(false)
  const n = index + 1
  const titleError = errorFor(fieldError, { kind: 'step-title', index })
  const detailError = errorFor(fieldError, { kind: 'step-detail', index })
  const detailShown = detailAsked || step.detail !== '' || detailError !== null

  useEffect(() => {
    if (detailAsked) {
      detailField.current?.focus()
    }
  }, [detailAsked])

  return (
    <li data-step={step.id} className={styles.step}>
      <span aria-hidden="true" className={joinClasses('text-mono-sm', styles.number)}>
        {padStep(n)}
      </span>
      <div className={styles.stepBody}>
        <div className={styles.stepRow}>
          <TextInput
            label={fillTemplate(taskEntry.stepTitleLabel, { n })}
            value={step.title}
            placeholder={taskEntry.stepTitlePlaceholder}
            invalid={titleError !== null}
            describedBy={titleError !== null ? titleErrorId : undefined}
            onChange={(text) => onChange({ title: text.slice(0, TASK_ENTRY_LIMITS.title) })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
              }
            }}
            className={styles.stepTitle}
          />
          <fieldset aria-label={fillTemplate(taskEntry.ownerLabel, { n })} className={styles.owner}>
            {OWNERS.map(({ owner, label }) => (
              <label key={owner} className={styles.ownerOption}>
                <input
                  type="radio"
                  name={groupName}
                  value={owner}
                  checked={step.owner === owner}
                  onChange={() => onChange({ owner })}
                  className={styles.ownerInput}
                />
                <span className={joinClasses('text-control', styles.ownerLabel)}>{label}</span>
              </label>
            ))}
          </fieldset>
          {!detailShown && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={fillTemplate(taskEntry.detailLabel, { n })}
              onPress={() => setDetailAsked(true)}
            >
              {taskEntry.detail}
            </Button>
          )}
          {removable && (
            <IconButton
              glyph={REMOVE_GLYPH}
              aria-label={fillTemplate(taskEntry.removeStep, { n })}
              onPress={onRemove}
            />
          )}
        </div>
        {titleError !== null && <FieldError id={titleErrorId} text={titleError} />}
        {detailShown && (
          <TextArea
            ref={detailField}
            label={fillTemplate(taskEntry.detailLabel, { n })}
            minHeight={76}
            value={step.detail}
            placeholder={taskEntry.detailPlaceholder}
            invalid={detailError !== null}
            describedBy={detailError !== null ? detailErrorId : undefined}
            onChange={(text) => onChange({ detail: text.slice(0, TASK_ENTRY_LIMITS.detail) })}
          />
        )}
        {detailError !== null && <FieldError id={detailErrorId} text={detailError} />}
      </div>
    </li>
  )
}
