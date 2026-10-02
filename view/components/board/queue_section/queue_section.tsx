// Copied from anachoic inertia/components/board/queue_section/queue_section.tsx at fd99e0d
import { useId } from 'react'
import { assistive, queue } from '../../helpers/strings'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import type { QueueTask } from '../board_data'
import { BoardSection } from '../board_section/board_section'
import { QueueCard } from '../queue_card/queue_card'

export interface QueueSectionProps {
  /** In queue order, front first. */
  tasks: readonly QueueTask[]
  /** A change of order is in flight. */
  busy?: boolean
  /** The task open in the task panel, so its card shows as selected. */
  selectedTaskId?: string | null
  onOpenTask: (taskId: string) => void
  /** Moves a task to a position counted from 1. Without it no card has a Move handle. */
  onReorder?: (taskId: string, position: number) => void
}

/**
 * The Queue in order, front first. It never folds, because its cards are
 * moved within it. A Queue of one has nothing to reorder, so its card has no
 * Move handle.
 */
export function QueueSection({
  tasks,
  busy = false,
  selectedTaskId = null,
  onOpenTask,
  onReorder,
}: QueueSectionProps) {
  const instructionsId = useId()
  const reorderable = onReorder !== undefined && tasks.length > 1
  const anyMovable = reorderable && tasks.some((task) => task.canAct.reorder)

  return (
    <BoardSection
      title={queue.title}
      count={tasks.length}
      folds={false}
      listElement="ol"
      cardGap="loose"
      cards={tasks.map((task) => ({
        id: task.task.id,
        card: (
          <QueueCard
            task={task}
            selected={task.task.id === selectedTaskId}
            movable={reorderable && task.canAct.reorder}
            busy={busy}
            instructionsId={instructionsId}
            onOpenTask={onOpenTask}
          />
        ),
      }))}
      footer={
        anyMovable && (
          <VisuallyHidden id={instructionsId}>{assistive.moveDescription}</VisuallyHidden>
        )
      }
    />
  )
}
