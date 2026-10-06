import type { BoardProps } from '../../../shared/props'
import type { BoardData } from '../../components/board/board_data'

export type BoardLists = Omit<BoardData, 'updatedAt' | 'unreachable' | 'safeAreaInsets'>

/**
 * The server's board props in the board view's own terms.
 */
export function toBoardData(props: BoardProps): BoardLists {
  const workerIds = new Set(
    props.sessions.filter((session) => session.kind === 'worker').map((session) => session.id)
  )
  const workerId = (session?: { id: string }) =>
    session && workerIds.has(session.id) ? session.id : null

  return {
    yourTurn: props.yourTurn.map(({ session, ...item }) => ({
      ...item,
      sessionName: session?.name ?? null,
      workerId: workerId(session),
    })),
    working: props.working.map(({ session, ...item }) => ({
      ...item,
      sessionName: session.name,
      workerId: workerId(session),
    })),
    queue: props.queue,
    backlog: props.backlog,
    toSignOff: props.toSignOff,
    signedOff: props.signedOff,
    sessions: props.sessions,
    counts: props.counts,
  }
}
