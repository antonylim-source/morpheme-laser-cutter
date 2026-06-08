import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { StageScaler } from './components/StageScaler'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StageScaler>
      <App />
    </StageScaler>
  </StrictMode>,
)
