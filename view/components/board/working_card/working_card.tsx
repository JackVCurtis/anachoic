import { joinClasses } from '../../helpers/join_classes'
import { producesLine } from '../../helpers/output_format'
import { stepCounter } from '../../helpers/steps'
import { fillTemplate, working } from '../../helpers/strings'
import { formatElapsed } from '../../helpers/time'
import { joinFacts } from '../../helpers/words'
import { LABEL_TICK, useNow } from '../../hooks/use_now/use_now'
import { StepPips } from '../../patterns/step_pips/step_pips'
import { ActionCard } from '../../primitives/action_card/action_card'
import { StatusSquare } from '../../primitives/status_square/status_square'
import { ArtifactLinks } from '../artifact_links/artifact_links'
import { assignmentFact } from '../assignment'
import type { WorkingTask } from '../board_data'
import { pipsOf, stepCount } from '../pips'
import styles from './working_card.module.css'
import { SymbolText } from '../../primitives/symbol_text/symbol_text'

export interface WorkingCardProps {
  item: WorkingTask
  onOpenTask: (taskId: string) => void
  /** Asks the host to open an artifact link. Without it the card draws no links. */
  onOpenLink?: (url: string) => void
}

/**
 * An active task whose current step is running: the session that claimed it,
 * how long it has run, the worker it is assigned to, the step and what it
 * will produce, the session's latest note, and the links its done steps
 * produced.
 */
export function WorkingCard({ item, onOpenTask, onOpenLink }: WorkingCardProps) {
  const now = useNow(LABEL_TICK.elapsed)
  const { task, step, sessionName, steps } = item
  const assignment = assignmentFact(task)

  return (
    <ActionCard
      title={task.title}
      onAction={() => onOpenTask(task.id)}
      className={styles.card}
      titleClassName={joinClasses('text-title-3', styles.title)}
      leading={
        <div className={styles.header}>
          <StatusSquare state="running" />
          <span className={joinClasses('text-name', styles.name)}>{sessionName}</span>
          <span className={joinClasses('text-status', 'text-tabular', styles.elapsed)}>
            {fillTemplate(working.elapsed, { elapsed: formatElapsed(step.runningSince, now) })}
          </span>
        </div>
      }
    >
      <span className={styles.meta}>
        <span className={joinClasses('text-mono-xs', styles.id)}>{task.displayId}</span>
        {assignment !== '' && (
          <>
            <span aria-hidden="true" className={joinClasses('text-hint', styles.fact)}>
              {' · '}
            </span>
            <span className={joinClasses('text-hint', styles.fact)}>{assignment}</span>
          </>
        )}
      </span>
      <p className={styles.stepLine}>
        <SymbolText>
          {joinFacts([stepCounter(step.number, stepCount(steps, step.number), 'long'), step.title])}
        </SymbolText>
      </p>
      {step.outputFormat && (
        <p className={joinClasses('text-hint', styles.produces)}>
          {producesLine(step.outputFormat)}
        </p>
      )}
      {step.note && (
        <p data-raised className={joinClasses('text-detail', styles.note)}>
          {step.note}
        </p>
      )}
      {steps.length > 0 && <StepPips steps={pipsOf(steps)} />}
      {item.artifacts && onOpenLink && (
        <ArtifactLinks artifacts={item.artifacts} onOpenLink={onOpenLink} />
      )}
    </ActionCard>
  )
}
