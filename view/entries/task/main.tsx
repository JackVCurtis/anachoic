import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loadTask, TaskEntry } from './task_entry'
import '../../css/app.css'

const root = createRoot(document.getElementById('app')!)

loadTask().then(
  (loaded) => {
    root.render(
      <StrictMode>
        <TaskEntry {...loaded} />
      </StrictMode>
    )
  },
  (error: unknown) => {
    console.error('The task view could not connect to its host.', error)
  }
)
