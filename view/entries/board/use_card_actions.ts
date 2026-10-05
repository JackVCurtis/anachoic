import { useState } from 'react'
import type { ActionResult, BoardProps } from '../../../shared/props'
import type { BoardSource } from '../../bridge/board_source'
import type { ToolOutcome } from '../../bridge/tools'
import type { YourActions } from '../../bridge/wake'
import type { BoardViewActions } from '../../components/board/board_view/board_view'
import type { CardAction, PendingCardAction } from '../../components/board/board_data'
import type { FailedWrite } from './use_board_messages'

type CardActionProps = Required<
  Pick<
    BoardViewActions,
    'onMoveToBacklog' | 'onSignOff' | 'onFollowUp' | 'onArchive' | 'onRejectFinished'
  >
> &
  Pick<BoardViewActions, 'pending'>

/**
 * The actions on the Queue, Backlog and Done cards: each calls its tool
 * through yourActions, and the board is drawn from the result. While one is in flight its card shows it as pending.
 * A failure goes to onFailure, and a follow-up's draft stays in its composer.
 */
export function useCardActions(
  yourActions: Pick<
    YourActions,
    'moveToBacklog' | 'signOff' | 'addFollowUp' | 'archiveTask' | 'rejectStep'
  >,
  source: Pick<BoardSource, 'replace'>,
  board: BoardProps,
  onFailure: (failure: FailedWrite) => void
): CardActionProps {
  const [pending, setPending] = useState<PendingCardAction | null>(null)

  async function run(
    taskId: string,
    action: CardAction,
    call: () => Promise<ToolOutcome<ActionResult>>
  ) {
    const mine = { taskId, action }
    setPending(mine)
    const outcome = await call()
    if (outcome.ok) {
      source.replace(outcome.props)
    }
    /* Another card's action may have started meanwhile; its pending state is kept. */
    setPending((current) => (current === mine ? null : current))
    if (!outcome.ok) {
      onFailure(outcome)
    }
  }

  function finished(taskId: string) {
    return board.toSignOff.find((item) => item.task.id === taskId)
  }

  return {
    pending,
    onMoveToBacklog: (taskId) => {
      const item = board.queue.find((queued) => queued.task.id === taskId)
      if (item) {
        void run(taskId, 'backlog', () => yourActions.moveToBacklog(item.task, false))
      }
    },
    onSignOff: (taskId) => {
      const item = finished(taskId)
      if (item) {
        void run(taskId, 'signOff', () => yourActions.signOff(item.task))
      }
    },
    onFollowUp: (taskId, followUp) => {
      const item = finished(taskId)
      if (item) {
        void run(taskId, 'followUp', () => yourActions.addFollowUp(item.task, followUp))
      }
    },
    onRejectFinished: (taskId, note) => {
      const item = finished(taskId)
      if (item) {
        void run(taskId, 'reject', () => yourActions.rejectStep(item.task, note))
      }
    },
    onArchive: (taskId) => {
      const item =
        finished(taskId) ?? board.backlog.find((backlogged) => backlogged.task.id === taskId)
      if (item) {
        void run(taskId, 'archive', () => yourActions.archiveTask(item.task))
      }
    },
  }
}
