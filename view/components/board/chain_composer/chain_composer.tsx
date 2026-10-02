import { useEffect, useId, useRef, useState } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { isOutputFormat, OUTPUT_OPTIONS } from '../../helpers/output_format'
import { fillTemplate, taskEntry } from '../../helpers/strings'
import {
  TASK_ENTRY_LIMITS,
  newTaskEntryStep,
  type TaskEntryField,
  type TaskEntryFieldError,
  type TaskEntryStep,
} from '../../helpers/task_entry'
import { padStep } from '../../helpers/words'
import { Button } from '../../primitives/button/button'
import { IconButton } from '../../primitives/icon_button/icon_button'
import { Select } from '../../primitives/select/select'
import { TextArea } from '../../primitives/text_area/text_area'
import { TextInput } from '../../primitives/text_input/text_input'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import type { Owner } from '../../types'
import styles from './chain_composer.module.css'

export interface ChainComposerProps {
  steps: readonly TaskEntryStep[]
  /** The number of the first step. Steps appended to a chain number on after it. */
  firstNumber?: number
  /** A message from the server about the steps or one of them. */
  fieldError?: TaskEntryFieldError | null
  onChange: (steps: TaskEntryStep[]) => void
}

const REMOVE_GLYPH = '×'

function sameField(a: TaskEntryField, b: TaskEntryField): boolean {
  return a.kind === b.kind && ('index' in a ? 'index' in b && a.index === b.index : true)
}

/**
 * The server's message about a field, or null when it is about another one.
 */
export function errorFor(
  fieldError: TaskEntryFieldError | null | undefined,
  field: TaskEntryField
) {
  return fieldError && sameField(fieldError.field, field) ? fieldError.text : null
}

/**
 * A message from the server about a field, shown under it.
 */
export function FieldError({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className={joinClasses('text-hint', styles.error)}>
      {text}
    </p>
  )
}

/**
 * The steps of a chain being written: an ordered list of 1 to 20 steps, each
 * with a title, an owner, an optional detail and, on your steps, an output
 * format, and "Add step". The steps belong to the parent.
 */
export function ChainComposer({
  steps,
  firstNumber = 1,
  fieldError = null,
  onChange,
}: ChainComposerProps) {
  const labelId = useId()
  const errorId = useId()
  const box = useRef<HTMLDivElement>(null)
  /** The step whose title takes focus once it is drawn. */
  const focusStep = useRef<string | null>(null)
  const stepsError = errorFor(fieldError, { kind: 'steps' })

  useEffect(() => {
    if (focusStep.current !== null) {
      box.current
        ?.querySelector<HTMLInputElement>(`[data-step="${focusStep.current}"] input[type="text"]`)
        ?.focus()
      focusStep.current = null
    }
  })

  /** A step handed to an agent loses its output format, which only your steps may declare. */
  function changeStep(index: number, change: Partial<TaskEntryStep>) {
    const cleared = change.owner === 'agent' ? { outputFormat: null } : {}
    onChange(steps.map((step, at) => (at === index ? { ...step, ...change, ...cleared } : step)))
  }

  function addStep() {
    const step = newTaskEntryStep()
    onChange([...steps, step])
    focusStep.current = step.id
  }

  function removeStep(index: number) {
    const rest = steps.filter((_, at) => at !== index)
    onChange(rest)
    focusStep.current = rest[Math.min(index, rest.length - 1)]?.id ?? null
  }

  return (
    <div ref={box} className={styles.field}>
      <VisuallyHidden element="span" id={labelId}>
        {taskEntry.stepsLabel}
      </VisuallyHidden>
      <ol aria-labelledby={labelId} className={styles.steps}>
        {steps.map((step, index) => (
          <StepRow
            key={step.id}
            step={step}
            index={index}
            number={firstNumber + index}
            removable={steps.length > 1}
            fieldError={fieldError}
            onChange={(change) => changeStep(index, change)}
            onRemove={() => removeStep(index)}
          />
        ))}
      </ol>
      {stepsError !== null && <FieldError id={errorId} text={stepsError} />}
      {steps.length < TASK_ENTRY_LIMITS.steps && (
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
  )
}

interface StepRowProps {
  step: TaskEntryStep
  /** Its place in the list, from 0. */
  index: number
  /** The number it shows. */
  number: number
  removable: boolean
  fieldError: TaskEntryFieldError | null
  onChange: (change: Partial<TaskEntryStep>) => void
  onRemove: () => void
}

const OWNERS: ReadonlyArray<{ owner: Owner; label: string }> = [
  { owner: 'agent', label: taskEntry.ownerAgent },
  { owner: 'you', label: taskEntry.ownerYou },
]

function StepRow({
  step,
  index,
  number: n,
  removable,
  fieldError,
  onChange,
  onRemove,
}: StepRowProps) {
  const groupName = useId()
  const titleErrorId = useId()
  const detailErrorId = useId()
  const detailField = useRef<HTMLTextAreaElement>(null)
  const [detailAsked, setDetailAsked] = useState(false)
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
          {step.owner === 'you' && (
            <div className={styles.output}>
              <span aria-hidden="true" className={joinClasses('text-label', styles.outputLabel)}>
                {taskEntry.outputLabel}
              </span>
              <Select
                label={fillTemplate(taskEntry.outputStepLabel, { n })}
                options={OUTPUT_OPTIONS}
                value={step.outputFormat ?? ''}
                onChange={(value) =>
                  onChange({ outputFormat: isOutputFormat(value) ? value : null })
                }
                className={styles.outputSelect}
              />
            </div>
          )}
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
