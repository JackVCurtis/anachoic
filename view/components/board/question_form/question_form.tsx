import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import {
  answerPage,
  FORM_TEXT_MAX,
  isAnswered,
  nextPageId,
  pagesLeft,
  pathOf,
  type FormPage,
  type FormResponse,
  type QuestionFormData,
} from '../../helpers/question_form'
import { fillTemplate, questionForm } from '../../helpers/strings'
import { Button } from '../../primitives/button/button'
import { TextArea } from '../../primitives/text_area/text_area'
import styles from './question_form.module.css'

export interface QuestionFormProps {
  form: QuestionFormData
  /** The answers so far, kept by the card so they survive a redraw. */
  responses: readonly FormResponse[]
  onChange: (responses: FormResponse[]) => void
  /** "Answer" on the last page of the path, with every answer on it. */
  onSubmit: (responses: FormResponse[]) => void
  /** "Answer directly": the user leaves the form to answer in their own words. */
  onAnswerDirectly: () => void
  /** The answer is in flight. */
  busy?: boolean
  /** Another action on the card is in flight. */
  disabled?: boolean
}

/**
 * An agent's form, one page at a time, on the inverted card: the question,
 * its options or a text field, and Back, Next or Answer. Changing an answer
 * drops the answers after it, since it may lead to other pages. "Answer
 * directly" is always offered, so the user is never held to the form.
 */
export function QuestionForm({
  form,
  responses,
  onChange,
  onSubmit,
  onAnswerDirectly,
  busy = false,
  disabled = false,
}: QuestionFormProps) {
  const path = pathOf(form, responses)
  const [shown, setShown] = useState(path.length - 1)
  const at = Math.min(shown, path.length - 1)
  const page = path[at]
  const response = responses[at]
  const answered = page ? isAnswered(page, response) : false
  const left = page ? pagesLeft(form, page.id) : { least: 0, most: 0 }
  /* The last page of the path: answered, it leads nowhere; unanswered, no answer can lead on. */
  const last = answered && page && response ? nextPageId(page, response) === null : left.most === 1

  const fields = useRef<HTMLDivElement>(null)
  const moved = useRef(false)
  useEffect(() => {
    /* Focus follows the page the user moved to, never the first one drawn. */
    if (moved.current) fields.current?.querySelector<HTMLElement>('input, textarea')?.focus()
  }, [at])

  if (!page) return null

  const progress = fillTemplate(
    left.least === left.most ? questionForm.progress : questionForm.progressUpTo,
    { n: at + 1, m: at + left.most }
  )

  function go(index: number) {
    moved.current = true
    setShown(index)
  }

  function set(next: FormResponse) {
    onChange(answerPage(responses, at, next))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || disabled || !answered) return
    if (last) {
      onSubmit(responses.slice(0, at + 1) as FormResponse[])
    } else {
      go(at + 1)
    }
  }

  return (
    <form data-raised className={styles.form} onSubmit={submit}>
      <p className={joinClasses('text-status', 'text-tabular', styles.progress)}>
        {form.pages.length > 1 ? progress : null}
      </p>
      <PageFields
        key={page.id}
        page={page}
        response={response}
        fieldsRef={fields}
        disabled={busy || disabled}
        onAnswer={set}
      />
      <div className={styles.buttons}>
        {at > 0 && (
          <Button variant="inverse-outline" disabled={busy} onPress={() => go(at - 1)}>
            {questionForm.back}
          </Button>
        )}
        <Button
          variant="inverse-solid"
          type="submit"
          busy={busy}
          disabled={disabled || (!answered && !busy)}
        >
          {last ? questionForm.answer : questionForm.next}
        </Button>
        <Button variant="inverse-outline" disabled={busy || disabled} onPress={onAnswerDirectly}>
          {questionForm.answerDirectly}
        </Button>
      </div>
    </form>
  )
}

interface PageFieldsProps {
  page: FormPage
  response: FormResponse | undefined
  fieldsRef: RefObject<HTMLDivElement | null>
  disabled: boolean
  onAnswer: (response: FormResponse) => void
}

/**
 * One page's question and the control that answers it: radios for "one",
 * checkboxes for "many", a text field for "text".
 */
function PageFields({ page, response, fieldsRef, disabled, onAnswer }: PageFieldsProps) {
  const questionId = useId()
  const hintId = useId()
  const name = useId()
  const picked = response?.page === page.id ? (response.picked ?? []) : []
  const text = response?.page === page.id ? (response.text ?? '') : ''
  const hint =
    page.choose === 'one'
      ? questionForm.pickOne
      : page.choose === 'many'
        ? questionForm.pickMany
        : questionForm.typeAnswer

  function toggle(index: number) {
    if (page.choose === 'one') {
      onAnswer({ page: page.id, picked: [index] })
      return
    }
    const next = picked.includes(index)
      ? picked.filter((each) => each !== index)
      : [...picked, index].sort((a, b) => a - b)
    onAnswer({ page: page.id, picked: next })
  }

  return (
    <div
      ref={fieldsRef}
      role={page.choose === 'text' ? undefined : 'group'}
      aria-labelledby={page.choose === 'text' ? undefined : questionId}
      aria-describedby={page.choose === 'text' ? undefined : hintId}
      className={styles.page}
    >
      <div className={styles.header}>
        <h4 id={questionId} className={joinClasses('text-body-sm', styles.question)}>
          {page.question}
        </h4>
        <span id={hintId} className={joinClasses('text-hint', styles.hint)}>
          {hint}
        </span>
      </div>
      {page.choose === 'text' ? (
        <TextArea
          labelledBy={questionId}
          describedBy={hintId}
          minHeight={64}
          value={text}
          placeholder={questionForm.textPlaceholder}
          disabled={disabled}
          onChange={(next) => onAnswer({ page: page.id, text: next.slice(0, FORM_TEXT_MAX) })}
        />
      ) : (
        <ul className={styles.options}>
          {(page.options ?? []).map((option, index) => (
            <li key={index}>
              <label className={joinClasses('text-body-sm', styles.option)}>
                <input
                  type={page.choose === 'one' ? 'radio' : 'checkbox'}
                  name={name}
                  className={styles.control}
                  checked={picked.includes(index)}
                  disabled={disabled}
                  onChange={() => toggle(index)}
                />
                <span className={styles.label}>{option.label}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
