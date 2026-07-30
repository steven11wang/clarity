import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthBoundary } from './auth/AuthBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthBoundary>
      <App />
    </AuthBoundary>
  </StrictMode>,
)
