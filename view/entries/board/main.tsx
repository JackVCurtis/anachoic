import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BoardEntry, loadBoard } from './board_entry'
import '../../css/app.css'

const root = createRoot(document.getElementById('app')!)

loadBoard().then(
  ({ connection, source }) => {
    root.render(
      <StrictMode>
        <BoardEntry connection={connection} source={source} />
      </StrictMode>
    )
  },
  (error: unknown) => {
    console.error('The board could not connect to its host.', error)
  }
)
