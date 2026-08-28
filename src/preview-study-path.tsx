// Dev-only harness for reviewing the first-entry study-path flow without
// walking through authentication or the paywall. Not part of the production
// build — vite.config.ts does not list this page as an input.
//
// The transcribed source note sits behind the modal so the copy can be checked
// against the handwriting it came from. Dismiss the popup to read it.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { StudyPathOnboarding } from './components/Adaptive/StudyPathOnboarding.tsx'
import type { StudyPathStartingStep } from './storage/index.ts'
import './app.css'
import './console-theme-v2.css'

const NOTE = {
  preface:
    'You cannot ace the SAT within 3 days unless you already have a 1550 (1600) score. I tried.',
  branches: [
    {
      question: 'Student → haven’t taken a single test',
      answer: 'Take a practice test in Blue Book, then come back.',
    },
    {
      question: 'Student → taken → what level?',
      answer:
        'Did not really study (~600) → learn the lessons first, then practice until you get to master level in each domain.\nStudy but did not really practice → go to 2.\nPractice but didn’t get a high score → go to 5.',
    },
  ],
  steps: [
    'Learn to read. Read every sentence, look up the words. / Learning to eliminate: eliminate all the answers before choosing the correct one (verbalize).',
    'Find your UDS score.',
    'Improve your critical thinking skill through 4 practice tests (untimed).',
    'Take a real test to see where you are — analyze.',
    'Most students find themselves losing points and losing time. That’s not because of the pace. That’s accuracy.',
    'Repetition: drill, re-do mistake, reflection, similar questions based on the mistake.',
  ],
  pillars: 'Critical thinking · Repetition · Reflection',
}

function Note({ onReopen, dismissed }: { onReopen: () => void; dismissed: boolean }) {
  return (
    <main className="study-path-preview-note">
      <header>
        <p className="eyebrow">Source note · IMG_6708 · transcribed</p>
        <h1>How to study for SAT reading</h1>
        <p className="preface">{NOTE.preface}</p>
      </header>

      <section>
        <h2>Branching</h2>
        {NOTE.branches.map(({ question, answer }) => (
          <div className="branch" key={question}>
            <strong>{question}</strong>
            <p>{answer}</p>
          </div>
        ))}
      </section>

      <section>
        <h2>Steps</h2>
        <ol>
          {NOTE.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Starred</h2>
        <p>{NOTE.pillars}</p>
      </section>

      {dismissed && (
        <button className="button" type="button" onClick={onReopen}>
          Reopen the popup
        </button>
      )}
    </main>
  )
}

function Harness() {
  const [open, setOpen] = useState(true)
  const [result, setResult] = useState<string | null>(null)

  return (
    <>
      <Note dismissed={!open} onReopen={() => { setResult(null); setOpen(true) }} />
      {result && <p className="study-path-preview-result">{result}</p>}
      {open && (
        <StudyPathOnboarding
          onDismiss={() => {
            setResult('Dismissed. Score setup opens next.')
            setOpen(false)
          }}
          onComplete={(step: StudyPathStartingStep) => {
            setResult(`Starting step ${step} saved. Score setup opens next.`)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
