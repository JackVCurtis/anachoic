// Copied from anachoic inertia/components/board/queue_card/queue_card.tsx at fd99e0d
import { useId } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { queuePosition } from '../../helpers/queue'
import { ownerLabel } from '../../helpers/steps'
import { fillTemplate, queue } from '../../helpers/strings'
import { joinFacts, splitFacts } from '../../helpers/words'
import { MetaLine } from '../../patterns/meta_line/meta_line'
import { StepPips } from '../../patterns/step_pips/step_pips'
import { ActionCard } from '../../primitives/action_card/action_card'
import type { BoardStep, QueueTask } from '../board_data'
import { MoveHandle } from '../move_handle/move_handle'
import { pipsOf } from '../pips'
import styles from './queue_card.module.css'

export interface QueueCardProps {
  task: QueueTask
  /** Its task is open in the task panel. */
  selected?: boolean
  /** It is being moved. */
  lifted?: boolean
  /** It has a Move handle. False for a card that cannot be moved. */
  movable: boolean
  /** A change of order is in flight, so the handle is disabled. */
  busy?: boolean
  /** The id of the section's hidden instructions for moving a card. */
  instructionsId: string
  onOpenTask: (taskId: string) => void
  onLift?: (taskId: string) => void
  onDrop?: (taskId: string) => void
}

/**
 * Where a queued task will pick up: "starts at step 1/3 · agent" when no step
 * is done, "resumes at step 3/5 · you" when some are. Empty for a chain with
 * no steps.
 */
function resumeLine(steps: readonly BoardStep[], nextOwner: QueueTask['nextOwner']): string {
  if (steps.length === 0) {
    return ''
  }
  const firstOpen = steps.findIndex((step) => step.status !== 'done')
  const values = { n: firstOpen === -1 ? steps.length : firstOpen + 1, m: steps.length }
  const resumes = steps.some((step) => step.status === 'done')
  return joinFacts([
    fillTemplate(resumes ? queue.resumes : queue.starts, values),
    ownerLabel(nextOwner, null, 'generic'),
  ])
}

/**
 * One queued task: where it stands in line, the way to move it, its chain and
 * where it will pick up.
 */
export function QueueCard({
  task,
  selected = false,
  lifted = false,
  movable,
  busy = false,
  instructionsId,
  onOpenTask,
  onLift,
  onDrop,
}: QueueCardProps) {
  const titleId = useId()

  return (
    <ActionCard
      element="div"
      title={task.task.title}
      titleId={titleId}
      selected={selected}
      lifted={lifted}
      onAction={() => onOpenTask(task.task.id)}
      className={styles.card}
      titleClassName={joinClasses('text-title-1', styles.title)}
      leading={
        <div className={styles.head}>
          <span className={styles.position}>{queuePosition(task.position)}</span>
          {movable && (
            <MoveHandle
              lifted={lifted}
              disabled={busy}
              describedBy={`${titleId} ${instructionsId}`}
              onLift={() => onLift?.(task.task.id)}
              onDrop={() => onDrop?.(task.task.id)}
            />
          )}
        </div>
      }
    >
      {task.steps.length > 0 && <StepPips steps={pipsOf(task.steps)} />}
      <MetaLine
        tone="meta"
        facts={[task.task.displayId, ...splitFacts(resumeLine(task.steps, task.nextOwner))]}
      />
    </ActionCard>
  )
}
