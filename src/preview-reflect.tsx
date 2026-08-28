// Dev-only harness for eyeballing the merged Reflect tab - the daily return and
// the error record on one page - without missing a dozen questions first. Not
// part of the production build.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { ReflectPanel } from './components/Reflect/ReflectPanel.tsx'
import { buildDailyPlan } from './review/daily.ts'
import { loadQuestions } from './data/questions.ts'
import { REVIEW_INTERVALS_MS, RETIRED_STAGE } from './review/schedule.ts'
import { recordAttempt, saveReview } from './storage/index.ts'
import type { Attempt, ErrorCause, Question, ReviewItem } from './types.ts'
import './app.css'
import './components/Adaptive/adaptive.css'
import './console-theme-v2.css'

const NOW = Date.now()

function attempt(question: Question, index: number, cause: ErrorCause | null): Attempt {
  return {
    questionId: question.id,
    timestamp: NOW - (index + 1) * 60 * 60 * 1000,
    chosen: 'B',
    correct: cause === null,
    confidence: index % 3 === 0 ? 'sure' : index % 3 === 1 ? 'leaning' : 'guessing',
    attemptsToCorrect: cause === null ? 1 : 2,
    errorCause: cause,
    selfExplanations: null,
    evidenceUnderlined: [],
    evidenceScore: null,
    chainBreakLink: null,
    trapGuess: null,
    trapActual: null,
    hiddenError: false,
    resurrectionStage: 0,
    timeSpentMs: 62_000,
    timedOut: index === 4,
  }
}

function seed(questions: Question[]) {
  const causes: Array<ErrorCause | null> = [
    'trap', 'trap', 'misread-question', 'rushed', 'knowledge-gap',
    'misread-passage', null, null, null,
  ]
  questions.slice(0, causes.length).forEach((question, index) => {
    recordAttempt(attempt(question, index, causes[index]))
  })

  const shape: Array<[number, number, ReviewItem['reason']]> = [
    [-2 * 60 * 60 * 1000, 0, 'miss'],
    [-30 * 60 * 1000, 1, 'timeout'],
    [-5 * 60 * 1000, 2, 'hidden-error'],
    [REVIEW_INTERVALS_MS[0], 1, 'miss'],
    [REVIEW_INTERVALS_MS[3], 3, 'miss'],
    [0, RETIRED_STAGE, 'miss'],
  ]
  const reviews: Record<string, ReviewItem> = {}
  questions.slice(0, shape.length).forEach((question, index) => {
    const [offset, stage, reason] = shape[index]
    const item: ReviewItem = {
      questionId: question.id,
      createdAt: NOW - 10 * 24 * 60 * 60 * 1000,
      dueAt: NOW + offset,
      stage,
      reason,
      clears: stage === RETIRED_STAGE ? 4 : Math.max(0, stage),
      lastReviewedAt: NOW - 60 * 60 * 1000,
    }
    reviews[question.id] = item
    saveReview(item)
  })
  return reviews
}

function Harness() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [reviews, setReviews] = useState<Record<string, ReviewItem>>({})
  useEffect(() => {
    void loadQuestions().then((loaded) => {
      setReviews(seed(loaded))
      setQuestions(loaded)
    })
  }, [])
  if (questions.length === 0) return <p>loading questions…</p>

  const plan = buildDailyPlan(questions, reviews, [], NOW, false)
  return (
    <div className="console-dashboard console-dashboard--today">
      <ReflectPanel
        plan={plan}
        at={NOW}
        streak={4}
        finishedToday={false}
        onStart={() => window.alert('start the return')}
        onOpenVault={() => window.alert('open the vault')}
        onOpenPractice={() => window.alert('open practice')}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
