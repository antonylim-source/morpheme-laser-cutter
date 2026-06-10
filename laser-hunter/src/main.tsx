import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { StageScaler } from './components/StageScaler'

// iOS Safari는 viewport meta의 user-scalable=no를 무시하므로 핀치 줌을 직접 차단
document.addEventListener('gesturestart', (e) => e.preventDefault())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StageScaler>
      <App />
    </StageScaler>
  </StrictMode>,
)
