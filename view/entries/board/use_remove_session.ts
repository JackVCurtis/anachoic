import { useState } from 'react'
import type { BoardSource } from '../../bridge/board_source'
import type { YourActions } from '../../bridge/wake'
import type { BoardViewActions } from '../../components/board/board_view/board_view'
import type { FailedWrite } from './use_board_messages'

type RemoveSessionProps = Required<Pick<BoardViewActions, 'onRemoveSession'>> &
  Pick<BoardViewActions, 'removingSessionId'>

/**
 * Remove on a worker's card: calls remove_session, draws the board from the
 * result, and sends a failure to onFailure. Nothing is posted to the chat.
 */
export function useRemoveSession(
  yourActions: Pick<YourActions, 'removeSession'>,
  source: Pick<BoardSource, 'replace'>,
  onFailure: (failure: FailedWrite) => void
): RemoveSessionProps {
  const [removingSessionId, setRemovingSessionId] = useState<string | null>(null)

  async function remove(sessionId: string) {
    setRemovingSessionId(sessionId)
    const outcome = await yourActions.removeSession(sessionId)
    if (outcome.ok) {
      source.replace(outcome.props)
    }
    setRemovingSessionId((current) => (current === sessionId ? null : current))
    if (!outcome.ok) {
      onFailure(outcome)
    }
  }

  return {
    removingSessionId,
    onRemoveSession: (sessionId) => void remove(sessionId),
  }
}
