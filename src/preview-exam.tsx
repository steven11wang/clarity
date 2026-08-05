// Dev-only harness for the Bluebook-style practice exam, so the runner can be
// checked without signing in and walking the console. Not part of the
// production build.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { PracticeExamPanel } from './components/Exam/PracticeExamPanel.tsx'
import './app.css'
import './components/Adaptive/adaptive.css'
import './console-theme-v2.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="console-dashboard console-dashboard--today" style={{ padding: '0 2.5rem' }}>
      <PracticeExamPanel />
    </div>
  </StrictMode>,
)
