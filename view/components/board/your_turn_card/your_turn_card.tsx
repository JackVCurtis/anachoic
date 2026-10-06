import { useId, useRef, useState, type FormEvent } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { inputLinkLabel } from '../../helpers/output_format'
import { DIRECT_ANSWER_MAX, type FormAnswer, type FormResponse } from '../../helpers/question_form'
import { fillTemplate, questionForm, reject, yourTurn } from '../../helpers/strings'
import { formatWaited } from '../../helpers/time'
import { LABEL_TICK, useNow } from '../../hooks/use_now/use_now'
import { InlineConfirm } from '../../patterns/inline_confirm/inline_confirm'
import { StepPips } from '../../patterns/step_pips/step_pips'
import { ActionCard } from '../../primitives/action_card/action_card'
import { Button } from '../../primitives/button/button'
import { StatusSquare } from '../../primitives/status_square/status_square'
import { Tag } from '../../primitives/tag/tag'
import { TextArea } from '../../primitives/text_area/text_area'
import { ArtifactLink } from '../artifact_links/artifact_links'
import { QuestionForm } from '../question_form/question_form'
import { RejectForm } from '../reject_form/reject_form'
import { StopAndRemove } from '../stop_and_remove/stop_and_remove'
import type { BoardBlock, YourTurnTask } from '../board_data'
import { pipsOf, stepCount } from '../pips'
import styles from './your_turn_card.module.css'
import { SymbolText } from '../../primitives/symbol_text/symbol_text'

/** What can be done with a step that waits on the user. */
export type YourTurnAction = 'complete' | 'answer' | 'park' | 'reject'

/** The Waiting on user action in flight, and the task it acts on. */
export interface YourTurnPending {
  taskId: string
  action: YourTurnAction
}

export interface YourTurnCardProps {
  item: YourTurnTask
  onOpenTask: (taskId: string) => void
  /** "Mark done" on a user step, with the note trimmed, or none. Without it the card offers no Mark done. */
  onCompleteStep?: (taskId: string, note?: string) => void
  /** "Answer" to an agent's form, or a direct answer trimmed. Without it the card offers no form. */
  onAnswer?: (taskId: string, answer: FormAnswer) => void
  /** A confirmed "Park". Without it the card offers no Park. */
  onPark?: (taskId: string) => void
  /** "Send back" on a user step, with the note trimmed. Without it the card offers no Reject. */
  onReject?: (taskId: string, note: string) => void
  /** This card's action in flight, if any. */
  busy?: YourTurnAction | null
  /** Asks the host to open the step's input link. Without it the card draws no link. */
  onOpenLink?: (url: string) => void
  /** Stops and removes the worker that blocked the step. Without it a blocked card offers no "Stop and Remove". */
  onRemoveSession?: (sessionId: string) => void
  /** The removal of that worker is in flight. */
  removing?: boolean
}

/** The longest note the tools take, as shared/limits.ts sets it. */
const NOTE_MAX = 500

/**
 * "User step" for a user step; for an agent's question, the session that
 * asks, or "Asks" when the props name none.
 */
function kindLabel({ step, sessionName }: YourTurnTask): string {
  if (step.owner === 'you') {
    return yourTurn.kindYourStep
  }
  return sessionName ? fillTemplate(yourTurn.asks, { session: sessionName }) : yourTurn.kindQuestion
}

/**
 * One step that waits on the user, inverted so that it cannot be missed: a
 * user step, an agent's question with the session that asks it, or a step a
 * worker blocked.
 */
export function YourTurnCard({
  item,
  onOpenTask,
  onCompleteStep,
  onAnswer,
  onPark,
  onReject,
  busy = null,
  onOpenLink,
  onRemoveSession,
  removing = false,
}: YourTurnCardProps) {
  if (item.blocked) {
    return (
      <BlockedCard
        item={item}
        blocked={item.blocked}
        onOpenTask={onOpenTask}
        onRemoveSession={onRemoveSession}
        removing={removing}
      />
    )
  }
  return (
    <WaitingCard
      item={item}
      onOpenTask={onOpenTask}
      onCompleteStep={onCompleteStep}
      onAnswer={onAnswer}
      onPark={onPark}
      onReject={onReject}
      busy={busy}
      onOpenLink={onOpenLink}
    />
  )
}

interface BlockedCardProps extends Pick<YourTurnCardProps, 'onRemoveSession' | 'removing'> {
  item: YourTurnTask
  blocked: BoardBlock
  onOpenTask: (taskId: string) => void
}

/**
 * A step its worker blocked: the worker, the step, the reason in full, how
 * long it has been blocked, and where to unblock it. It is unblocked in the
 * worker's session, so the card's only other action is "Stop and Remove",
 * which gives up on the worker and sends the step back to the queue.
 */
function BlockedCard({
  item,
  blocked,
  onOpenTask,
  onRemoveSession,
  removing = false,
}: BlockedCardProps) {
  const now = useNow(LABEL_TICK.waited)
  const { task, step, steps, sessionName } = item

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
          <Tag variant="accent">{yourTurn.kindBlocked}</Tag>
          {sessionName && <span className={styles.kind}>{sessionName}</span>}
          <span className={joinClasses('text-status', 'text-tabular', styles.counter)}>
            {fillTemplate(yourTurn.blockedFor, { waited: formatWaited(blocked.since, now) })}
          </span>
        </div>
      }
    >
      <p className={styles.step}>
        <span className={joinClasses('text-mono-xs', styles.id)}>{task.displayId}</span>
        <span className="text-body-sm">
          <SymbolText>
            {fillTemplate(yourTurn.blockedStep, { 'n': step.number, 'step title': step.title })}
          </SymbolText>
        </span>
      </p>
      <p data-raised className={joinClasses('text-body-sm', styles.reason)}>
        {blocked.reason}
      </p>
      {steps.length > 0 && <StepPips steps={pipsOf(steps)} />}
      <p className={joinClasses('text-hint', styles.unblock)}>
        {sessionName
          ? fillTemplate(yourTurn.unblockIn, { session: sessionName })
          : yourTurn.unblockInUnnamed}
      </p>
      {item.workerId && sessionName && onRemoveSession && (
        <StopAndRemove
          tone="inverse"
          workerName={sessionName}
          taskDisplayId={task.displayId}
          busy={removing}
          onConfirm={() => onRemoveSession(item.workerId!)}
        />
      )}
    </ActionCard>
  )
}

/**
 * A user step, or an agent's question, with the actions the server allows.
 * A user step links to the artifact the step before it produced, if any.
 */
function WaitingCard({
  item,
  onOpenTask,
  onCompleteStep,
  onAnswer,
  onPark,
  onReject,
  busy = null,
  onOpenLink,
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
            <SymbolText>{counter}</SymbolText>
          </span>
        </div>
      }
    >
      <p className={styles.step}>
        <span className={joinClasses('text-mono-xs', styles.id)}>{task.displayId}</span>
        <span className="text-body-sm">{step.title}</span>
      </p>
      {step.owner === 'agent' && step.form && !(item.canAct.answer && onAnswer) && (
        <p data-raised className={joinClasses('text-body-sm', styles.question)}>
          {step.form.pages[0]?.question}
        </p>
      )}
      {steps.length > 0 && <StepPips steps={pipsOf(steps)} />}
      {step.owner === 'you' && item.input && onOpenLink && (
        <ArtifactLink
          url={item.input.url}
          label={inputLinkLabel(item.input.format, item.input.stepNumber)}
          onOpenLink={onOpenLink}
          className={styles.input}
        />
      )}
      <YourTurnActions
        item={item}
        onCompleteStep={onCompleteStep}
        onAnswer={onAnswer}
        onPark={onPark}
        onReject={onReject}
        busy={busy}
      />
    </ActionCard>
  )
}

type YourTurnActionsProps = Omit<YourTurnCardProps, 'onOpenTask' | 'busy' | 'onOpenLink'> & {
  busy: YourTurnAction | null
}

/** Whether the card offers Mark done. */
function completesHere(
  { step, canAct }: YourTurnTask,
  onCompleteStep: YourTurnCardProps['onCompleteStep']
): boolean {
  return step.owner === 'you' && canAct.complete === true && onCompleteStep !== undefined
}

interface Draft {
  stepKey: string
  /** The note on a user step, or the direct answer to an agent's form. */
  text: string
  responses: FormResponse[]
  /** The user chose to answer in their own words instead of the form. */
  direct: boolean
}

/**
 * The card's actions, offered only where the server says they can act: Mark
 * done with an optional note on a user step, an agent's form page by page or
 * a direct answer instead, Reject behind a note on a user step that follows
 * an agent's, and Park behind a confirmation on either. The draft is kept by
 * step, so a new step on the same task starts empty.
 */
function YourTurnActions({
  item,
  onCompleteStep,
  onAnswer,
  onPark,
  onReject,
  busy,
}: YourTurnActionsProps) {
  const { task, step, canAct, sessionName } = item
  const labelId = useId()
  const noteId = useId()
  const parkButton = useRef<HTMLButtonElement>(null)
  const rejectButton = useRef<HTMLButtonElement>(null)
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const stepKey = `${task.id}:${step.number}`
  const empty: Draft = { stepKey, text: '', responses: [], direct: false }
  const [stored, setDraft] = useState<Draft>(empty)
  const draft = stored.stepKey === stepKey ? stored : empty
  const { text } = draft
  const form = step.owner === 'agent' ? step.form : null
  const direct = draft.direct || !form

  const completes = completesHere(item, onCompleteStep)
  const answers = step.owner === 'agent' && canAct.answer === true && onAnswer !== undefined
  const parks = canAct.park && onPark !== undefined
  const rejects = step.owner === 'you' && canAct.reject === true && onReject !== undefined
  if (!completes && !answers && !parks && !rejects) {
    return null
  }

  if (rejecting && rejects) {
    return (
      <RejectForm
        tone="inverse"
        busy={busy === 'reject'}
        onSend={(note) => onReject?.(task.id, note)}
        onCancel={() => setRejecting(false)}
        returnFocusTo={rejectButton}
      />
    )
  }

  const answerEmpty = text.trim() === ''
  const answerNote = answerEmpty
    ? yourTurn.needsAnswer
    : sessionName
      ? fillTemplate(yourTurn.answerReady, { session: sessionName })
      : yourTurn.answerReadyUnnamed

  function edit(next: string) {
    setDraft({ ...draft, text: next.slice(0, answers ? DIRECT_ANSWER_MAX : NOTE_MAX) })
  }

  function complete() {
    onCompleteStep?.(task.id, text.trim() === '' ? undefined : text.trim())
  }

  function answer(event?: FormEvent) {
    event?.preventDefault()
    if (!answerEmpty && busy === null) {
      onAnswer?.(task.id, { direct: text.trim() })
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
      {answers && direct && (
        <Button
          variant="inverse-solid"
          type="submit"
          busy={busy === 'answer'}
          disabled={(busy !== null && busy !== 'answer') || (answerEmpty && busy === null)}
        >
          {yourTurn.answer}
        </Button>
      )}
      {answers && direct && form && (
        <Button
          variant="inverse-outline"
          disabled={busy !== null}
          onPress={() => setDraft({ ...draft, direct: false })}
        >
          {questionForm.backToForm}
        </Button>
      )}
      {rejects && (
        <Button
          ref={rejectButton}
          variant="inverse-outline"
          disabled={busy !== null}
          onPress={() => setRejecting(true)}
        >
          {reject.reject}
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

  if (answers && !direct && form) {
    return (
      <div data-raised className={styles.actions}>
        <QuestionForm
          form={form}
          responses={draft.responses}
          busy={busy === 'answer'}
          disabled={busy !== null && busy !== 'answer'}
          onChange={(responses) => setDraft({ ...draft, responses })}
          onSubmit={(responses) => onAnswer?.(task.id, { responses })}
          onAnswerDirectly={() => setDraft({ ...draft, direct: true })}
        />
        {(parks || confirming) && actionRow}
      </div>
    )
  }

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
