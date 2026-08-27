// Dev-only harness for reviewing the first-entry study-path flow without
// walking through authentication. Not part of the production build.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { StudyPathOnboarding } from './components/Adaptive/StudyPathOnboarding.tsx'
import type { StudyPathStartingStep } from './storage/index.ts'
import './app.css'
import './console-theme-v2.css'

function Harness() {
  const [result, setResult] = useState<string | null>(null)

  if (result) {
    return (
      <main className="app-status">
        <span className="wordmark">clarity<span>.</span></span>
        <p>{result}</p>
        <button className="button" type="button" onClick={() => setResult(null)}>
          Preview again
        </button>
      </main>
    )
  }

  return (
    <StudyPathOnboarding
      onDismiss={() => setResult('Flow dismissed. Score setup opens next.')}
      onComplete={(step: StudyPathStartingStep) => {
        setResult(`Starting step ${step} saved. Score setup opens next.`)
      }}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
