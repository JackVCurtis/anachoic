import { yourTurn } from '../../helpers/strings'
import { EmptyState } from '../../patterns/empty_state/empty_state'
import type { YourTurnTask } from '../board_data'
import { BoardSection } from '../board_section/board_section'
import {
  YourTurnCard,
  type YourTurnCardProps,
  type YourTurnPending,
} from '../your_turn_card/your_turn_card'

export interface YourTurnSectionProps extends Pick<
  YourTurnCardProps,
  'onCompleteStep' | 'onAnswer' | 'onPark'
> {
  /** In the server's order. */
  tasks: readonly YourTurnTask[]
  onOpenTask: (taskId: string) => void
  /** The Your turn action in flight, if any. */
  pending?: YourTurnPending | null
}

/**
 * What waits on you, under a header on the inverse surface. It folds after
 * eight cards.
 */
export function YourTurnSection({
  tasks,
  onOpenTask,
  onCompleteStep,
  onAnswer,
  onPark,
  pending = null,
}: YourTurnSectionProps) {
  return (
    <BoardSection
      title={yourTurn.title}
      count={tasks.length}
      inverseHeader
      empty={<EmptyState variant="dashed" message={yourTurn.nothingWaiting} />}
      cards={tasks.map((item) => ({
        id: item.task.id,
        card: (
          <YourTurnCard
            item={item}
            onOpenTask={onOpenTask}
            onCompleteStep={onCompleteStep}
            onAnswer={onAnswer}
            onPark={onPark}
            busy={pending?.taskId === item.task.id ? pending.action : null}
          />
        ),
      }))}
    />
  )
}
