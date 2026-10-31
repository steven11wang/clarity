// Dev-only entry for the Mistake Notebook redesign preview at /redesign.html.
// Not part of the production build: vite.config.ts lists only index, landing
// and plans as inputs, so the live site's design is untouched.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App.tsx'
import './styles/base.css'
import './styles/landing.css'
import './styles/game.css'
import './styles/auth.css'
import './styles/social.css'
import './styles/exam.css'
import './styles/shop.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
