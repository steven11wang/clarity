import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthBoundary } from './auth/AuthBoundary.tsx'
// Swap to './console-theme.css' to fall back to the previous design.
import './console-theme-v2.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthBoundary>
      <App />
    </AuthBoundary>
  </StrictMode>,
)
