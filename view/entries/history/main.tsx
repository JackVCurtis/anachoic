import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HistoryEntry, loadHistory } from './history_entry'
import '../../css/app.css'

const root = createRoot(document.getElementById('app')!)

loadHistory().then(
  (loaded) => {
    root.render(
      <StrictMode>
        <HistoryEntry {...loaded} />
      </StrictMode>
    )
  },
  (error: unknown) => {
    console.error('The History view could not connect to its host.', error)
  }
)
