import { useEffect, useMemo, useState } from 'react'

import {
  AdaptiveExperience,
  type AdaptiveAttemptReference,
} from './components/Adaptive/AdaptiveExperience.tsx'
import type { BatchAnswers } from './components/Adaptive/BatchQuiz.tsx'
import { Browse } from './components/Browse/Browse.tsx'
import { Dashboard } from './components/Dashboard/Dashboard.tsx'
import { AnswerPass } from './components/QuestionInteraction/AnswerPass.tsx'
import { QuestionInteraction } from './components/QuestionInteraction/QuestionInteraction.tsx'
import { firstPassAttempt } from './components/QuestionInteraction/model.ts'
import { SessionSummary } from './components/SessionSummary/SessionSummary.tsx'
import { loadQuestions } from './data/questions.ts'
import { normalizeProgression, type ProgressionState } from './progression/model.ts'
import { buildTaxonomy } from './progression/questions.ts'
import { applyReview, isClean, scheduleMistake } from './review/schedule.ts'
import { buildStream, type StreamItem } from './review/stream.ts'
import {
  advanceClock,
  clearAll,
  getProgression,
  getReview,
  getReviews,
  getSettings,
  now,
  recordAttempt,
  saveProgression,
  saveReview,
  setDemoMode,
  setTimeLimit,
  setTimedMode,
} from './storage/index.ts'
import type { Level } from './progression/config.ts'
import type { Attempt, FirstPass, Question } from './types.ts'
import './app.css'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'
type View = 'adaptive' | 'lessons' | 'browse' | 'practice' | 'insights'
type SessionPhase = 'answer' | 'review-intro' | 'review' | 'summary'

function App() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [view, setView] = useState<View>('adaptive')
  const [progression, setProgression] = useState<ProgressionState | null>(null)

  const [stream, setStream] = useState<StreamItem[]>([])
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('answer')
  const [answerIndex, setAnswerIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, FirstPass>>({})
  const [reviewList, setReviewList] = useState<StreamItem[]>([])
  const [reviewIndex, setReviewIndex] = useState(0)
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
        if (loaded.length === 0) {
          setLoadState('empty')
          return
        }
        setQuestions(loaded)
        setProgression(
          normalizeProgression(getProgression(), buildTaxonomy(loaded)),
        )
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
    setAnswerIndex(0)
    setAnswers({})
    setReviewList([])
    setReviewIndex(0)
    setSessionAttempts([])
    setSessionPhase('answer')
    setView('practice')
  }

  function updateProgression(next: ProgressionState) {
    saveProgression(next)
    setProgression(next)
  }

  function recordAdaptiveAnswers(
    activityId: string,
    assessmentQuestions: Question[],
    batchAnswers: BatchAnswers,
    activityKind: 'diagnostic' | 'skill' | 'checkpoint',
    practiceLevel: Level,
  ): Record<string, AdaptiveAttemptReference> {
    const timestamp = Date.now()
    const scheduleTime = now()
    let scheduled = false
    const references: Record<string, AdaptiveAttemptReference> = {}

    assessmentQuestions.forEach((question, index) => {
      const chosen = batchAnswers[question.id]
      const correct = chosen === question.answer
      const attemptTimestamp = timestamp + index
      const reviewStage = getReview(question.id)?.stage ?? 0
      references[question.id] = {
        timestamp: attemptTimestamp,
        reviewStage,
      }
      recordAttempt({
        questionId: question.id,
        timestamp: attemptTimestamp,
        chosen,
        correct,
        confidence: null,
        attemptsToCorrect: correct ? 1 : 0,
        errorCause: null,
        selfExplanations: null,
        evidenceUnderlined: [],
        evidenceScore: null,
        chainBreakLink: null,
        trapGuess: null,
        trapActual: null,
        hiddenError: false,
        resurrectionStage: reviewStage,
        timeSpentMs: null,
        timedOut: false,
        activityId,
        activityKind,
        practiceLevel,
      })

      if (!correct) {
        saveReview(
          scheduleMistake(
            getReview(question.id),
            question.id,
            'miss',
            getSettings().demoMode,
            scheduleTime,
          ),
        )
        scheduled = true
      }
    })

    if (scheduled) setReviewsVersion((version) => version + 1)
    return references
  }

  function recordAdaptiveReview(
    attempt: Attempt,
    reference: AdaptiveAttemptReference,
    activityId: string,
    activityKind: 'diagnostic' | 'skill' | 'checkpoint',
    practiceLevel: Level,
  ) {
    recordAttempt({
      ...attempt,
      timestamp: reference.timestamp,
      resurrectionStage: reference.reviewStage,
      activityId,
      activityKind,
      practiceLevel,
    })
  }

  // Record + schedule a completed attempt. Correct answers are finalized right
  // after the answer pass; missed ones after their review.
  function finalizeAttempt(attempt: Attempt, item: StreamItem) {
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

  function handleAnswer(firstPass: FirstPass) {
    const item = stream[answerIndex]
    const next = { ...answers, [item.question.id]: firstPass }
    setAnswers(next)
    if (answerIndex + 1 < stream.length) {
      setAnswerIndex((i) => i + 1)
    } else {
      finishAnswerPass(next)
    }
  }

  function finishAnswerPass(allAnswers: Record<string, FirstPass>) {
    // Log the correct answers now so calibration + scheduling see them; queue
    // the missed ones for review.
    const missed: StreamItem[] = []
    for (const item of stream) {
      const fp = allAnswers[item.question.id]
      if (fp.correct) {
        finalizeAttempt(firstPassAttempt(item.question.id, fp, item.reviewStage, Date.now()), item)
      } else {
        missed.push(item)
      }
    }
    setReviewList(missed)
    setReviewIndex(0)
    setSessionPhase(missed.length === 0 ? 'summary' : 'review-intro')
  }

  function handleReviewNext() {
    if (reviewIndex + 1 < reviewList.length) {
      setReviewIndex((i) => i + 1)
    } else {
      setSessionPhase('summary')
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
  if (loadState === 'empty') {
    return (
      <main className="app-status">
        <p>Clarity loaded, but this practice bank doesn’t contain any questions yet.</p>
        <button type="button" onClick={() => window.location.reload()}>Try loading again</button>
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
          setTimedModeState(false)
          setTimeLimitState(90)
          setProgression(null)
          setView('adaptive')
          setReviewsVersion((v) => v + 1)
        }}
      >
        Reset data
      </button>
    </div>
  )

  if (view !== 'practice') {
    const primaryView =
      view === 'lessons'
        ? 'lessons'
        : view === 'browse'
          ? 'library'
          : view === 'insights'
            ? 'insights'
            : 'practice'

    return (
      <>
        <AdaptiveExperience
          primaryView={primaryView}
          libraryPanel={(
            <Browse
              embedded
              questions={questions}
              dueCount={dueNow}
              timedMode={timedMode}
              timeLimitSec={timeLimitSec}
              onToggleTimed={toggleTimed}
              onChangeLimit={changeLimit}
              onStart={startSession}
              onOpenDashboard={() => setView('adaptive')}
            />
          )}
          insightsPanel={(
            <Dashboard
              embedded
              onBack={() => setView('adaptive')}
            />
          )}
          questions={questions}
          progression={progression}
          onProgressionChange={updateProgression}
          onOpenPractice={() => setView('adaptive')}
          onOpenLessons={() => setView('lessons')}
          onOpenLibrary={() => setView('browse')}
          onOpenInsights={() => setView('insights')}
          onRecordAnswers={recordAdaptiveAnswers}
          onRecordReview={recordAdaptiveReview}
        />
        {devBar}
      </>
    )
  }

  // --- Practice (two-pass) --------------------------------------------------

  if (sessionPhase === 'summary') {
    return (
      <>
        <SessionSummary
          attempts={sessionAttempts}
          onPracticeMore={() => setView('browse')}
          onDashboard={() => setView('adaptive')}
        />
        {devBar}
      </>
    )
  }

  const header = (
    <header className="app-header">
      <button className="wordmark wordmark--button" type="button" onClick={() => setView('browse')} aria-label="Back to Browse">
        clarity<span>.</span>
      </button>
      <button className="link-button" type="button" onClick={() => setView('adaptive')}>Dashboard</button>
    </header>
  )

  if (sessionPhase === 'review-intro') {
    const right = stream.length - reviewList.length
    return (
      <>
        <main className="app-shell">
          {header}
          <section className="pass-intro">
            <p className="eyebrow">Answers locked in</p>
            <h1>{right} right, {reviewList.length} to review.</h1>
            <p>
              No scores to chase — the value is here. Redo each one you missed, diagnose it in your own
              words, then see the reasoning. They’ll come back later, disguised, until they can’t catch you.
            </p>
            <button className="button" type="button" onClick={() => setSessionPhase('review')}>
              Start the review →
            </button>
          </section>
        </main>
        {devBar}
      </>
    )
  }

  const inReview = sessionPhase === 'review'
  const item = inReview ? reviewList[reviewIndex] : stream[answerIndex]
  const total = inReview ? reviewList.length : stream.length
  const pos = inReview ? reviewIndex : answerIndex
  const progress = total ? Math.round(((pos + 1) / total) * 100) : 0

  return (
    <>
      <main className="app-shell">
        {header}

        <section className="question-progress" aria-label="Session progress">
          <div className="progress-copy">
            <span>{inReview ? 'Review' : 'Answer'} — {pos + 1} of {total}</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-track">
            <div className={`progress-value ${inReview ? 'progress-value--review' : ''}`} style={{ width: `${progress}%` }} />
          </div>
        </section>

        <article className="practice-card">
          <div className="question-meta">
            <span>{item.question.domain}</span>
            <span className="meta-dot" aria-hidden="true">•</span>
            <span>{item.question.skill}</span>
            <span className="difficulty">{item.question.difficulty}</span>
          </div>

          {inReview ? (
            <QuestionInteraction
              key={item.question.id}
              question={item.question}
              isReview={item.isReview}
              firstPass={answers[item.question.id]}
              reviewStage={item.reviewStage}
              onComplete={(attempt) => finalizeAttempt(attempt, item)}
              onNext={handleReviewNext}
            />
          ) : (
            <AnswerPass
              key={item.question.id}
              question={item.question}
              isReview={item.isReview}
              timedMode={timedMode}
              timeLimitSec={timeLimitSec}
              onAnswer={handleAnswer}
            />
          )}
        </article>
      </main>
      {devBar}
    </>
  )
}

export default App
