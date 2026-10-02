import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../css/app.css'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <p>Completed tasks</p>
  </StrictMode>
)
