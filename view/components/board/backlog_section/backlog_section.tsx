// Copied from anachoic inertia/components/board/backlog_section/backlog_section.tsx at fd99e0d
import { backlog } from '../../helpers/strings'
import type { BacklogTask, PendingCardAction } from '../board_data'
import { BacklogCard } from '../backlog_card/backlog_card'
import { BoardSection } from '../board_section/board_section'
import styles from './backlog_section.module.css'

export interface BacklogSectionProps {
  /** In the server's order. */
  tasks: readonly BacklogTask[]
  /** The task open in the task panel, so its card shows as selected. */
  selectedTaskId?: string | null
  onOpenTask: (taskId: string) => void
  /** Sends a task to the Queue. Without it no card offers "Queue →". */
  onQueueTask?: (taskId: string) => void
  /** Archives a task once confirmed. Without it no card offers "Archive". */
  onArchive?: (taskId: string) => void
  /** The card action in flight, if any. */
  pending?: PendingCardAction | null
}

/**
 * The tasks not yet lined up. The Backlog is not reordered, and it folds after
 * eight cards.
 */
export function BacklogSection({
  tasks,
  selectedTaskId = null,
  onOpenTask,
  onQueueTask,
  onArchive,
  pending = null,
}: BacklogSectionProps) {
  return (
    <BoardSection
      title={backlog.title}
      count={tasks.length}
      cardGap="loose"
      className={styles.section}
      cards={tasks.map((task) => ({
        id: task.task.id,
        card: (
          <BacklogCard
            task={task}
            selected={task.task.id === selectedTaskId}
            onOpenTask={onOpenTask}
            onQueueTask={onQueueTask}
            onArchive={onArchive}
            pending={pending?.taskId === task.task.id ? pending.action : null}
          />
        ),
      }))}
    />
  )
}
