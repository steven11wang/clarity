// Dev-only harness for eyeballing the mistake vault without missing a dozen
// questions first. Not part of the production build.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { MistakeVault } from './components/Review/MistakeVault.tsx'
import { loadQuestions } from './data/questions.ts'
import { REVIEW_INTERVALS_MS, RETIRED_STAGE } from './review/schedule.ts'
import type { Question, ReviewItem } from './types.ts'
import './app.css'
import './components/Adaptive/adaptive.css'
import './console-theme-v2.css'

const NOW = Date.now()

function fakeReviews(questions: Question[]): Record<string, ReviewItem> {
  const picks = questions.slice(0, 7)
  const shape: Array<[number, number, ReviewItem['reason']]> = [
    [-2 * 60 * 60 * 1000, 0, 'miss'],
    [-30 * 60 * 1000, 1, 'timeout'],
    [-5 * 60 * 1000, 2, 'hidden-error'],
    [REVIEW_INTERVALS_MS[0], 1, 'miss'],
    [REVIEW_INTERVALS_MS[2], 2, 'miss'],
    [REVIEW_INTERVALS_MS[3], 3, 'miss'],
    [0, RETIRED_STAGE, 'miss'],
  ]
  return Object.fromEntries(
    picks.map((question, index) => {
      const [offset, stage, reason] = shape[index]
      return [question.id, {
        questionId: question.id,
        createdAt: NOW - 10 * 24 * 60 * 60 * 1000,
        dueAt: NOW + offset,
        stage,
        reason,
        clears: stage === RETIRED_STAGE ? 4 : Math.max(0, stage),
        lastReviewedAt: NOW - 60 * 60 * 1000,
      }] as const
    }),
  )
}

function Harness() {
  const [questions, setQuestions] = useState<Question[]>([])
  useEffect(() => {
    void loadQuestions().then(setQuestions)
  }, [])
  if (questions.length === 0) return <p>loading questions…</p>
  return (
    <div className="console-dashboard console-dashboard--reviews">
      <MistakeVault
        questions={questions}
        reviews={fakeReviews(questions)}
        now={NOW}
        onStart={(subset) => window.alert(`start session with ${subset.length} questions`)}
        onBack={() => window.alert('back')}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
