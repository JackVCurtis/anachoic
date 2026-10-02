import type { BoardProps } from '../../../shared/props'
import type { BoardData } from '../../components/board/board_data'

export type BoardLists = Omit<BoardData, 'updatedAt' | 'unreachable' | 'safeAreaInsets'>

/**
 * The server's board props in the board view's own terms.
 */
export function toBoardData(props: BoardProps): BoardLists {
  return {
    yourTurn: props.yourTurn.map(({ session, ...item }) => ({
      ...item,
      sessionName: session?.name ?? null,
    })),
    working: props.working.map(({ session, ...item }) => ({ ...item, sessionName: session.name })),
    queue: props.queue,
    backlog: props.backlog,
    toSignOff: props.toSignOff,
    signedOff: props.signedOff,
    sessions: props.sessions,
    counts: props.counts,
  }
}
