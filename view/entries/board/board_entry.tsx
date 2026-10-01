import type { BoardProps } from '../../../shared/props'
import { connectToHost, type ConnectOptions, type HostConnection } from '../../bridge/connect'
import { HostContextProvider, useHostContext } from '../../bridge/host_context'
import { getBoard } from '../../bridge/tools'
import { BoardView } from '../../components/board/board_view/board_view'
import { toBoardData } from './to_board_data'

export interface LoadedBoard {
  connection: HostConnection
  /** Nothing when the first get_board did not return the board. */
  board: BoardProps | null
}

/**
 * Connects to the host and fetches the board once. The tool result the host
 * replays is never drawn, because it may be old.
 */
export async function loadBoard(options: ConnectOptions = {}): Promise<LoadedBoard> {
  const connection = await connectToHost(options)
  const outcome = await getBoard(connection.app)
  const board = outcome.ok && !('changed' in outcome.props) ? outcome.props : null
  return { connection, board }
}

function Board({ board }: { board: BoardProps }) {
  const { safeAreaInsets } = useHostContext()
  return (
    <BoardView
      {...toBoardData(board)}
      updated={false}
      unreachable={false}
      safeAreaInsets={safeAreaInsets}
    />
  )
}

export function BoardEntry({
  connection,
  board,
}: {
  connection: HostConnection
  board: BoardProps
}) {
  return (
    <HostContextProvider store={connection.hostContext}>
      <Board board={board} />
    </HostContextProvider>
  )
}
