import { useEffect, useMemo, useState } from 'react'

import { Browse } from './components/Browse/Browse.tsx'
import { Dashboard } from './components/Dashboard/Dashboard.tsx'
import { QuestionInteraction } from './components/QuestionInteraction/QuestionInteraction.tsx'
import { SessionSummary } from './components/SessionSummary/SessionSummary.tsx'
import { loadQuestions } from './data/questions.ts'
import { applyReview, isClean, scheduleMistake } from './review/schedule.ts'
import { buildStream, type StreamItem } from './review/stream.ts'
import {
  advanceClock,
  clearAll,
  getReview,
  getReviews,
  getSettings,
  now,
  recordAttempt,
  saveReview,
  setDemoMode,
  setTimeLimit,
  setTimedMode,
} from './storage/index.ts'
import type { Attempt, Question } from './types.ts'
import './app.css'

type LoadState = 'loading' | 'ready' | 'error'
type View = 'browse' | 'practice' | 'summary' | 'dashboard'

function App() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [view, setView] = useState<View>('browse')
  const [stream, setStream] = useState<StreamItem[]>([])
  const [index, setIndex] = useState(0)
  const [sessionAttempts, setSessionAttempts] = useState<Attempt[]>([])
  const [demoMode, setDemoModeState] = useState(false)
  const [timedMode, setTimedModeState] = useState(false)
  const [timeLimitSec, setTimeLimitState] = useState(90)
  const [reviewsVersion, setReviewsVersion] = useState(0)

  useEffect(() => {
    const s = getSettings()
    setDemoModeState(s.demoMode)
    setTimedModeState(s.timedMode)
    setTimeLimitState(s.timeLimitSec)
    loadQuestions()
      .then((loaded) => {
        setQuestions(loaded)
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
  }, [])

  const dueNow = useMemo(() => {
    void reviewsVersion
    const reviews = getReviews()
    const nowTs = now()
    return Object.values(reviews).filter((r) => r.stage >= 0 && r.dueAt <= nowTs).length
  }, [reviewsVersion, view])

  function startSession(subset: Question[]) {
    setStream(buildStream(subset, getReviews(), now()))
    setIndex(0)
    setSessionAttempts([])
    setView('practice')
  }

  function handleComplete(attempt: Attempt, item: StreamItem) {
    recordAttempt(attempt)
    setSessionAttempts((prev) => [...prev, attempt])

    const demo = getSettings().demoMode
    const existing = getReview(attempt.questionId)
    const nowTs = now()

    if (item.isReview && existing) {
      saveReview(applyReview(existing, isClean(attempt.correct, attempt.evidenceScore), demo, nowTs))
    } else if (attempt.timedOut) {
      saveReview(scheduleMistake(existing, attempt.questionId, 'timeout', demo, nowTs))
    } else if (!attempt.correct) {
      saveReview(scheduleMistake(existing, attempt.questionId, 'miss', demo, nowTs))
    } else if (attempt.hiddenError) {
      saveReview(scheduleMistake(existing, attempt.questionId, 'hidden-error', demo, nowTs))
    }
    setReviewsVersion((v) => v + 1)
  }

  function handleNext() {
    if (index + 1 >= stream.length) {
      setView('summary')
    } else {
      setIndex((i) => i + 1)
    }
  }

  function toggleDemo() {
    const next = !demoMode
    setDemoMode(next)
    setDemoModeState(next)
  }

  function toggleTimed() {
    const next = !timedMode
    setTimedMode(next)
    setTimedModeState(next)
  }

  function changeLimit(sec: number) {
    setTimeLimit(sec)
    setTimeLimitState(sec)
  }

  function jumpAhead() {
    advanceClock(24 * 60 * 60 * 1000)
    setReviewsVersion((v) => v + 1)
  }

  if (loadState === 'loading') {
    return <main className="app-status">Loading your practice set…</main>
  }
  if (loadState === 'error') {
    return (
      <main className="app-status">
        <p>Clarity couldn’t load the practice set.</p>
        <button type="button" onClick={() => window.location.reload()}>Try again</button>
      </main>
    )
  }

  const devBar = (
    <div className="dev-bar" role="group" aria-label="Demo controls">
      <span className="dev-tag">demo</span>
      <label className="dev-toggle">
        <input type="checkbox" checked={demoMode} onChange={toggleDemo} />
        Compress schedule (2/7/30 d → 20/60/180 s)
      </label>
      <button type="button" onClick={jumpAhead}>Jump +1 day</button>
      <button
        type="button"
        onClick={() => {
          clearAll()
          setDemoModeState(false)
          setReviewsVersion((v) => v + 1)
        }}
      >
        Reset data
      </button>
    </div>
  )

  if (view === 'browse') {
    return (
      <>
        <Browse
          questions={questions}
          dueCount={dueNow}
          timedMode={timedMode}
          timeLimitSec={timeLimitSec}
          onToggleTimed={toggleTimed}
          onChangeLimit={changeLimit}
          onStart={startSession}
          onOpenDashboard={() => setView('dashboard')}
        />
        {devBar}
      </>
    )
  }

  if (view === 'dashboard') {
    return (
      <>
        <Dashboard onBack={() => setView('browse')} />
        {devBar}
      </>
    )
  }

  if (view === 'summary') {
    return (
      <>
        <SessionSummary
          attempts={sessionAttempts}
          onPracticeMore={() => setView('browse')}
          onDashboard={() => setView('dashboard')}
        />
        {devBar}
      </>
    )
  }

  const item = stream[index]
  const progress = stream.length ? Math.round(((index + 1) / stream.length) * 100) : 0

  return (
    <>
      <main className="app-shell">
        <header className="app-header">
          <button
            className="wordmark wordmark--button"
            type="button"
            onClick={() => setView('browse')}
            aria-label="Back to Browse"
          >
            clarity<span>.</span>
          </button>
          <button className="link-button" type="button" onClick={() => setView('dashboard')}>
            Dashboard
          </button>
        </header>

        <section className="question-progress" aria-label="Session progress">
          <div className="progress-copy">
            <span>Question {index + 1} of {stream.length}</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-value" style={{ width: `${progress}%` }} />
          </div>
        </section>

        <article className="practice-card">
          <div className="question-meta">
            <span>{item.question.domain}</span>
            <span className="meta-dot" aria-hidden="true">•</span>
            <span>{item.question.skill}</span>
            <span className="difficulty">{item.question.difficulty}</span>
          </div>
          <QuestionInteraction
            key={item.question.id}
            question={item.question}
            isReview={item.isReview}
            reviewStage={item.reviewStage}
            timedMode={timedMode}
            timeLimitSec={timeLimitSec}
            onComplete={(attempt) => handleComplete(attempt, item)}
            onNext={handleNext}
          />
        </article>
      </main>
      {devBar}
    </>
  )
}

export default App
