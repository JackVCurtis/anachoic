import { useState } from 'react'
import type { ActionResult, BoardProps } from '../../../shared/props'
import type { BoardSource } from '../../bridge/board_source'
import type { ToolOutcome } from '../../bridge/tools'
import type { YourActions } from '../../bridge/wake'
import type { BoardViewYourTurn } from '../../components/board/board_view/board_view'
import type {
  YourTurnAction,
  YourTurnPending,
} from '../../components/board/your_turn_card/your_turn_card'
import type { FailedWrite } from './use_board_messages'

/**
 * The actions on the Your turn cards: Mark done, Answer and Park. Each calls
 * its tool through yourActions, and the board is drawn from the result, which
 * also resets the poll timer. Mark done sends the artifact link the step
 * needs, if any. A failure goes to onFailure, and the card keeps its draft.
 */
export function useYourTurnActions(
  yourActions: Pick<YourActions, 'completeMyStep' | 'answerQuestion' | 'moveToBacklog'>,
  source: Pick<BoardSource, 'replace'>,
  board: BoardProps,
  onFailure: (failure: FailedWrite) => void
): Required<BoardViewYourTurn> {
  const [pending, setPending] = useState<YourTurnPending | null>(null)

  async function run(
    taskId: string,
    action: YourTurnAction,
    call: (item: BoardProps['yourTurn'][number]) => Promise<ToolOutcome<ActionResult>>
  ) {
    const item = board.yourTurn.find((waiting) => waiting.task.id === taskId)
    if (!item) {
      return
    }
    const mine = { taskId, action }
    setPending(mine)
    const outcome = await call(item)
    if (outcome.ok) {
      source.replace(outcome.props)
    }
    /* Another card's action may have started meanwhile; its pending state is kept. */
    setPending((current) => (current === mine ? null : current))
    if (!outcome.ok) {
      onFailure(outcome)
    }
  }

  return {
    yourTurnPending: pending,
    onCompleteStep: (taskId, note, artifactUrl) =>
      void run(taskId, 'complete', ({ task, step }) =>
        yourActions.completeMyStep(task, step, note, artifactUrl)
      ),
    onAnswer: (taskId, answer) =>
      void run(taskId, 'answer', ({ task, step }) =>
        yourActions.answerQuestion(task, step.number, answer)
      ),
    onPark: (taskId) =>
      void run(taskId, 'park', ({ task }) => yourActions.moveToBacklog(task, true)),
  }
}
