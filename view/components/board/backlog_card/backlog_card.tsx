// Copied from anachoic inertia/components/board/backlog_card/backlog_card.tsx at fd99e0d
import { useId, useRef, useState } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { chainNote } from '../../helpers/steps'
import { backlog, done, fillTemplate } from '../../helpers/strings'
import { splitFacts } from '../../helpers/words'
import { InlineConfirm } from '../../patterns/inline_confirm/inline_confirm'
import { MetaLine } from '../../patterns/meta_line/meta_line'
import { ActionCard } from '../../primitives/action_card/action_card'
import { Button } from '../../primitives/button/button'
import { assignmentFact } from '../assignment'
import type { BacklogTask, CardAction } from '../board_data'
import styles from './backlog_card.module.css'

const QUEUE_ARROW = '→'

export interface BacklogCardProps {
  task: BacklogTask
  /** Its task is open in the task panel. */
  selected?: boolean
  onOpenTask: (taskId: string) => void
  /** Sends the task to the Queue. Without it the card offers no "Queue →". */
  onQueueTask?: (taskId: string) => void
  /** Archives the task once confirmed. Without it the card offers no "Archive". */
  onArchive?: (taskId: string) => void
  /** The action in flight on this card, whose button is busy while the others are disabled. */
  pending?: CardAction | null
}

/**
 * One task not yet lined up, with the button that sends it to the Queue when
 * the server says it can go, and "Archive", which asks first. It has no pips
 * and no Move handle: the Backlog is not reordered.
 */
export function BacklogCard({
  task,
  selected = false,
  onOpenTask,
  onQueueTask,
  onArchive,
  pending = null,
}: BacklogCardProps) {
  const titleId = useId()
  const archiveButton = useRef<HTMLButtonElement>(null)
  const [confirming, setConfirming] = useState(false)
  const archivable = task.canAct.archive && onArchive !== undefined
  const yourSteps = task.steps.filter((step) => step.owner === 'you').length
  const facts = [
    task.task.displayId,
    ...splitFacts(chainNote(task.steps.length, yourSteps)),
    assignmentFact(task.task),
  ]

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
        {!(confirming && archivable) && (
          <div className={styles.buttons}>
            {archivable && (
              <Button
                ref={archiveButton}
                variant="ghost"
                size="sm"
                aria-describedby={titleId}
                disabled={pending !== null}
                onPress={() => setConfirming(true)}
              >
                {done.archive}
              </Button>
            )}
            {task.canAct.queue && onQueueTask && (
              <Button
                variant="secondary"
                size="sm"
                aria-describedby={titleId}
                disabled={pending !== null}
                onPress={() => onQueueTask(task.task.id)}
              >
                {backlog.toQueue.replace(QUEUE_ARROW, '').trim()}
                <span aria-hidden="true">{QUEUE_ARROW}</span>
              </Button>
            )}
          </div>
        )}
      </div>
      {confirming && archivable && (
        <div data-raised>
          <InlineConfirm
            question={fillTemplate(done.archiveQuestion, { title: task.task.title })}
            confirmLabel={done.archive}
            dismissLabel={done.keepTask}
            layout="stack"
            busy={pending === 'archive'}
            onConfirm={() => onArchive?.(task.task.id)}
            onCancel={() => setConfirming(false)}
            returnFocusTo={archiveButton}
          />
        </div>
      )}
    </ActionCard>
  )
}
