// Copied from anachoic inertia/components/board/queue_card/queue_card.tsx at fd99e0d
import { useId, useLayoutEffect, useRef } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { queuePosition } from '../../helpers/queue'
import { ownerLabel } from '../../helpers/steps'
import { fillTemplate, queue } from '../../helpers/strings'
import { joinFacts, splitFacts } from '../../helpers/words'
import { MetaLine } from '../../patterns/meta_line/meta_line'
import { StepPips } from '../../patterns/step_pips/step_pips'
import { ActionCard } from '../../primitives/action_card/action_card'
import { Button } from '../../primitives/button/button'
import type { BoardStep, CardAction, QueueTask } from '../board_data'
import { ArtifactLinks } from '../artifact_links/artifact_links'
import { assignmentFact } from '../assignment'
import { MoveHandle, type HandleMove } from '../move_handle/move_handle'
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
  /** The action in flight on this card, whose button is busy while the others are disabled. */
  pending?: CardAction | null
  /** The id of the section's hidden instructions for moving a card. */
  instructionsId: string
  onOpenTask: (taskId: string) => void
  onLift?: (taskId: string) => void
  onDrop?: (taskId: string) => void
  onMove?: (taskId: string, move: HandleMove) => void
  onCancelMove?: (taskId: string) => void
  /** Sends the task back to the Backlog. Without it the card offers no "Move to backlog". */
  onMoveToBacklog?: (taskId: string) => void
  /** Asks the host to open an artifact link. Without it the card draws no links. */
  onOpenLink?: (url: string) => void
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
 * One queued task: where it stands in line, the way to move it, its chain,
 * where it will pick up, the worker it is assigned to and the links its done
 * steps produced.
 */
export function QueueCard({
  task,
  selected = false,
  lifted = false,
  movable,
  busy = false,
  pending = null,
  instructionsId,
  onOpenTask,
  onLift,
  onDrop,
  onMove,
  onCancelMove,
  onMoveToBacklog,
  onOpenLink,
}: QueueCardProps) {
  const titleId = useId()
  const handle = useRef<HTMLButtonElement>(null)

  /*
   * A lifted card keeps its handle focused and in view at each place it
   * takes. A keyed list may move the focused node itself, which drops focus,
   * so focus is put back after every move.
   */
  useLayoutEffect(() => {
    const element = handle.current
    if (!lifted || !element) {
      return
    }
    if (document.activeElement !== element) {
      element.focus({ preventScroll: true })
    }
    const card = element.closest('[data-card]') ?? element
    card.scrollIntoView({ block: 'nearest' })
  }, [lifted, task.position])

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
              ref={handle}
              lifted={lifted}
              disabled={busy || pending !== null}
              describedBy={`${titleId} ${instructionsId}`}
              onLift={() => onLift?.(task.task.id)}
              onDrop={() => onDrop?.(task.task.id)}
              onMove={(move) => onMove?.(task.task.id, move)}
              onCancel={() => onCancelMove?.(task.task.id)}
            />
          )}
        </div>
      }
    >
      {task.steps.length > 0 && <StepPips steps={pipsOf(task.steps)} />}
      <div className={styles.row}>
        <MetaLine
          tone="meta"
          facts={[
            task.task.displayId,
            ...splitFacts(resumeLine(task.steps, task.nextOwner)),
            assignmentFact(task.task),
          ]}
          className={styles.meta}
        />
        {task.canAct.backlog && onMoveToBacklog && (
          <Button
            variant="ghost"
            size="sm"
            aria-describedby={titleId}
            busy={pending === 'backlog'}
            disabled={busy || (pending !== null && pending !== 'backlog')}
            onPress={() => onMoveToBacklog(task.task.id)}
            className={styles.toBacklog}
          >
            {queue.toBacklog}
          </Button>
        )}
      </div>
      {task.artifacts && onOpenLink && (
        <ArtifactLinks artifacts={task.artifacts} onOpenLink={onOpenLink} />
      )}
    </ActionCard>
  )
}
