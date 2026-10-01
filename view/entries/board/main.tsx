import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { connectToHost } from '../../bridge/connect'
import { HostContextProvider, useHostContext } from '../../bridge/host_context'
import type { BoardData } from '../../components/board/board_data'
import { BoardView } from '../../components/board/board_view/board_view'
import '../../css/app.css'

const EMPTY_BOARD: BoardData = {
  yourTurn: [],
  working: [],
  queue: [],
  backlog: [],
  toSignOff: [],
  signedOff: [],
  sessions: [],
  counts: { yourTurn: 0, working: 0, queue: 0, toSignOff: 0 },
  updated: false,
  unreachable: false,
}

function BoardEntry() {
  const { safeAreaInsets } = useHostContext()
  return <BoardView {...EMPTY_BOARD} safeAreaInsets={safeAreaInsets} />
}

const root = createRoot(document.getElementById('app')!)

connectToHost().then(
  (connection) => {
    root.render(
      <StrictMode>
        <HostContextProvider store={connection.hostContext}>
          <BoardEntry />
        </HostContextProvider>
      </StrictMode>
    )
  },
  (error: unknown) => {
    console.error('The board could not connect to its host.', error)
  }
)
