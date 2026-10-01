import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './placeholder.css'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <h1>Anachoic board</h1>
  </StrictMode>
)
