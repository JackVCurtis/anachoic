import { useId, useRef, useState, type FormEvent } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { fillTemplate, yourTurn } from '../../helpers/strings'
import { formatWaited } from '../../helpers/time'
import { LABEL_TICK, useNow } from '../../hooks/use_now/use_now'
import { InlineConfirm } from '../../patterns/inline_confirm/inline_confirm'
import { StepPips } from '../../patterns/step_pips/step_pips'
import { ActionCard } from '../../primitives/action_card/action_card'
import { Button } from '../../primitives/button/button'
import { StatusSquare } from '../../primitives/status_square/status_square'
import { TextArea } from '../../primitives/text_area/text_area'
import type { YourTurnTask } from '../board_data'
import { pipsOf, stepCount } from '../pips'
import styles from './your_turn_card.module.css'

/** What you can do with a step that waits on you. */
export type YourTurnAction = 'complete' | 'answer' | 'park'

/** The Your turn action in flight, and the task it acts on. */
export interface YourTurnPending {
  taskId: string
  action: YourTurnAction
}

export interface YourTurnCardProps {
  item: YourTurnTask
  onOpenTask: (taskId: string) => void
  /** "Mark done" on your step, with the note trimmed, or none. Without it the card offers no Mark done. */
  onCompleteStep?: (taskId: string, note?: string) => void
  /** "Answer" to an agent's question, trimmed. Without it the card offers no answer field. */
  onAnswer?: (taskId: string, answer: string) => void
  /** A confirmed "Park". Without it the card offers no Park. */
  onPark?: (taskId: string) => void
  /** This card's action in flight, if any. */
  busy?: YourTurnAction | null
}

/** The longest note and answer the tools take, as shared/limits.ts sets them. */
const NOTE_MAX = 500
const ANSWER_MAX = 4000

/**
 * "Your step" for your own step; for an agent's question, the session that
 * asks, or "Asks" when the props name none.
 */
function kindLabel({ step, sessionName }: YourTurnTask): string {
  if (step.owner === 'you') {
    return yourTurn.kindYourStep
  }
  return sessionName ? fillTemplate(yourTurn.asks, { session: sessionName }) : yourTurn.kindQuestion
}

/**
 * One step that waits on you, inverted so that it cannot be missed: your own
 * step, or an agent's question with the session that asks it.
 */
export function YourTurnCard({
  item,
  onOpenTask,
  onCompleteStep,
  onAnswer,
  onPark,
  busy = null,
}: YourTurnCardProps) {
  const now = useNow(LABEL_TICK.waited)
  const { task, step, steps } = item
  const counter = fillTemplate(yourTurn.cardCounter, {
    n: step.number,
    m: stepCount(steps, step.number),
    waited: formatWaited(step.waitingSince, now),
  })

  return (
    <ActionCard
      tone="inverse"
      title={task.title}
      onAction={() => onOpenTask(task.id)}
      className={styles.card}
      titleClassName={joinClasses('text-title-4', styles.title)}
      leading={
        <div className={styles.top}>
          <StatusSquare state="attention" />
          <span className={styles.kind}>{kindLabel(item)}</span>
          <span className={joinClasses('text-status', 'text-tabular', styles.counter)}>
            {counter}
          </span>
        </div>
      }
    >
      <p className={styles.step}>
        <span className={joinClasses('text-mono-xs', styles.id)}>{task.displayId}</span>
        <span className="text-body-sm">{step.title}</span>
      </p>
      {step.owner === 'agent' && step.question && (
        <p data-raised className={joinClasses('text-body-sm', styles.question)}>
          {step.question}
        </p>
      )}
      {steps.length > 0 && <StepPips steps={pipsOf(steps)} />}
      <YourTurnActions
        item={item}
        onCompleteStep={onCompleteStep}
        onAnswer={onAnswer}
        onPark={onPark}
        busy={busy}
      />
    </ActionCard>
  )
}

type YourTurnActionsProps = Omit<YourTurnCardProps, 'onOpenTask' | 'busy'> & {
  busy: YourTurnAction | null
}

/**
 * The card's actions, offered only where the server says they can act: Mark
 * done with an optional note on your step, an answer field on an agent's
 * question, and Park behind a confirmation on either. The draft is kept by
 * step, so a new step on the same task starts empty.
 */
function YourTurnActions({ item, onCompleteStep, onAnswer, onPark, busy }: YourTurnActionsProps) {
  const { task, step, canAct, sessionName } = item
  const labelId = useId()
  const noteId = useId()
  const parkButton = useRef<HTMLButtonElement>(null)
  const [confirming, setConfirming] = useState(false)
  const stepKey = `${task.id}:${step.number}`
  const [draft, setDraft] = useState({ stepKey, text: '' })
  const text = draft.stepKey === stepKey ? draft.text : ''

  const completes = step.owner === 'you' && canAct.complete === true && onCompleteStep !== undefined
  const answers = step.owner === 'agent' && canAct.answer === true && onAnswer !== undefined
  const parks = canAct.park && onPark !== undefined
  if (!completes && !answers && !parks) {
    return null
  }

  const answerEmpty = text.trim() === ''
  const answerNote = answerEmpty
    ? yourTurn.needsAnswer
    : sessionName
      ? fillTemplate(yourTurn.answerReady, { session: sessionName })
      : yourTurn.answerReadyUnnamed

  function edit(next: string) {
    setDraft({ stepKey, text: next.slice(0, answers ? ANSWER_MAX : NOTE_MAX) })
  }

  function complete() {
    const note = text.trim()
    onCompleteStep?.(task.id, note === '' ? undefined : note)
  }

  function answer(event?: FormEvent) {
    event?.preventDefault()
    if (!answerEmpty && busy === null) {
      onAnswer?.(task.id, text.trim())
    }
  }

  const actionRow = confirming ? (
    <InlineConfirm
      layout="stack"
      question={fillTemplate(yourTurn.parkQuestion, { title: task.title })}
      confirmLabel={yourTurn.park}
      dismissLabel={yourTurn.keepStep}
      busy={busy === 'park'}
      returnFocusTo={parkButton}
      onConfirm={() => onPark?.(task.id)}
      onCancel={() => setConfirming(false)}
    />
  ) : (
    <div className={styles.buttons}>
      {completes && (
        <Button
          variant="inverse-solid"
          busy={busy === 'complete'}
          disabled={busy !== null && busy !== 'complete'}
          onPress={complete}
        >
          {yourTurn.markDone}
        </Button>
      )}
      {answers && (
        <Button
          variant="inverse-solid"
          type="submit"
          busy={busy === 'answer'}
          disabled={(busy !== null && busy !== 'answer') || (answerEmpty && busy === null)}
        >
          {yourTurn.answer}
        </Button>
      )}
      {parks && (
        <Button
          ref={parkButton}
          variant="inverse-outline"
          disabled={busy !== null}
          onPress={() => setConfirming(true)}
        >
          {yourTurn.park}
        </Button>
      )}
    </div>
  )

  if (answers) {
    return (
      <form data-raised className={styles.actions} onSubmit={answer}>
        <div className={styles.fieldHeader}>
          <span id={labelId} className={joinClasses('text-label', styles.label)}>
            {yourTurn.answerLabel}
          </span>
          <span id={noteId} className={joinClasses('text-hint', styles.note)}>
            {answerNote}
          </span>
        </div>
        <TextArea
          labelledBy={labelId}
          describedBy={noteId}
          minHeight={64}
          value={text}
          placeholder={yourTurn.answerPlaceholder}
          onChange={edit}
        />
        {actionRow}
      </form>
    )
  }

  return (
    <div data-raised className={styles.actions}>
      {completes && (
        <>
          <span id={labelId} className={joinClasses('text-label', styles.label)}>
            {yourTurn.noteLabel}
          </span>
          <TextArea
            labelledBy={labelId}
            minHeight={64}
            value={text}
            placeholder={yourTurn.notePlaceholder}
            onChange={edit}
          />
        </>
      )}
      {actionRow}
    </div>
  )
}
