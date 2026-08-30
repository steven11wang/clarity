import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthBoundary } from './auth/AuthBoundary.tsx'
import { capturePromoCodeFromUrl } from './lib/subscription.ts'
// Swap to './console-theme.css' to fall back to the previous design.
import './console-theme-v2.css'

// Advertising links land on /app?code=... and sign-in leaves through Google,
// which drops the query string. Park the code before that trip.
capturePromoCodeFromUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthBoundary>
      <App />
    </AuthBoundary>
  </StrictMode>,
)
