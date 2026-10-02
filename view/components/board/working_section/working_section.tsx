import { working } from '../../helpers/strings'
import { EmptyState } from '../../patterns/empty_state/empty_state'
import type { WorkingTask } from '../board_data'
import { BoardSection } from '../board_section/board_section'
import { WorkingCard } from '../working_card/working_card'

export interface WorkingSectionProps {
  /** In the server's order. */
  tasks: readonly WorkingTask[]
  onOpenTask: (taskId: string) => void
}

/**
 * The active tasks whose current step is running. It folds after eight cards.
 */
export function WorkingSection({ tasks, onOpenTask }: WorkingSectionProps) {
  return (
    <BoardSection
      title={working.title}
      count={tasks.length}
      empty={<EmptyState variant="dashed" message={working.nothingWorking} />}
      cards={tasks.map((item) => ({
        id: item.task.id,
        card: <WorkingCard item={item} onOpenTask={onOpenTask} />,
      }))}
    />
  )
}
