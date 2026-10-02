// Copied from anachoic inertia/components/board/backlog_card/backlog_card.tsx at fd99e0d
import { useId } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { chainNote } from '../../helpers/steps'
import { backlog } from '../../helpers/strings'
import { splitFacts } from '../../helpers/words'
import { MetaLine } from '../../patterns/meta_line/meta_line'
import { ActionCard } from '../../primitives/action_card/action_card'
import { Button } from '../../primitives/button/button'
import type { BacklogTask } from '../board_data'
import styles from './backlog_card.module.css'

const QUEUE_ARROW = '→'

export interface BacklogCardProps {
  task: BacklogTask
  /** Its task is open in the task panel. */
  selected?: boolean
  onOpenTask: (taskId: string) => void
  /** Sends the task to the Queue. Without it the card offers no "Queue →". */
  onQueueTask?: (taskId: string) => void
}

/**
 * One task not yet lined up, with the button that sends it to the Queue when
 * the server says it can go. It has no pips and no Move handle: the Backlog is
 * not reordered.
 */
export function BacklogCard({ task, selected = false, onOpenTask, onQueueTask }: BacklogCardProps) {
  const titleId = useId()
  const yourSteps = task.steps.filter((step) => step.owner === 'you').length
  const facts = [task.task.displayId, ...splitFacts(chainNote(task.steps.length, yourSteps))]

  return (
    <ActionCard
      element="div"
      title={task.task.title}
      titleId={titleId}
      selected={selected}
      onAction={() => onOpenTask(task.task.id)}
      className={styles.card}
      titleClassName={joinClasses('text-title-1', styles.title)}
    >
      <div className={styles.row}>
        <MetaLine tone="meta" facts={facts} className={styles.meta} />
        {task.canAct.queue && onQueueTask && (
          <Button
            variant="secondary"
            size="sm"
            aria-describedby={titleId}
            onPress={() => onQueueTask(task.task.id)}
            className={styles.queue}
          >
            {backlog.toQueue.replace(QUEUE_ARROW, '').trim()}
            <span aria-hidden="true">{QUEUE_ARROW}</span>
          </Button>
        )}
      </div>
    </ActionCard>
  )
}
