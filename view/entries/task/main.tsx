import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../css/app.css'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <h1>Anachoic task</h1>
  </StrictMode>
)
