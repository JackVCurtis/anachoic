import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BoardEntry, loadBoard } from './board_entry'
import '../../css/app.css'

const root = createRoot(document.getElementById('app')!)

loadBoard().then(
  ({ connection, board }) => {
    if (board === null) {
      console.error('The board could not be fetched.')
      return
    }
    root.render(
      <StrictMode>
        <BoardEntry connection={connection} board={board} />
      </StrictMode>
    )
  },
  (error: unknown) => {
    console.error('The board could not connect to its host.', error)
  }
)
