import { joinClasses } from '../../helpers/join_classes'
import { fillTemplate, yourTurn } from '../../helpers/strings'
import { formatWaited } from '../../helpers/time'
import { LABEL_TICK, useNow } from '../../hooks/use_now/use_now'
import { StepPips } from '../../patterns/step_pips/step_pips'
import { ActionCard } from '../../primitives/action_card/action_card'
import { StatusSquare } from '../../primitives/status_square/status_square'
import type { YourTurnTask } from '../board_data'
import { pipsOf, stepCount } from '../pips'
import styles from './your_turn_card.module.css'

export interface YourTurnCardProps {
  item: YourTurnTask
  onOpenTask: (taskId: string) => void
}

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
export function YourTurnCard({ item, onOpenTask }: YourTurnCardProps) {
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
    </ActionCard>
  )
}
