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
  'onCompleteStep' | 'onAnswer' | 'onPark' | 'onReject' | 'onOpenLink'
> {
  /** In the server's order. */
  tasks: readonly YourTurnTask[]
  onOpenTask: (taskId: string) => void
  /** The Waiting on user action in flight, if any. */
  pending?: YourTurnPending | null
}

/** What waits on the user. It folds after eight cards. */
export function YourTurnSection({
  tasks,
  onOpenTask,
  onCompleteStep,
  onAnswer,
  onPark,
  onReject,
  onOpenLink,
  pending = null,
}: YourTurnSectionProps) {
  return (
    <BoardSection
      title={yourTurn.title}
      count={tasks.length}
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
            onReject={onReject}
            onOpenLink={onOpenLink}
            busy={pending?.taskId === item.task.id ? pending.action : null}
          />
        ),
      }))}
    />
  )
}
