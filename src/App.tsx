import { useEffect, useMemo, useState } from 'react'

import {
  AdaptiveExperience,
  type AdaptiveAttemptReference,
} from './components/Adaptive/AdaptiveExperience.tsx'
import type { BatchAnswers } from './components/Adaptive/BatchQuiz.tsx'
import {
  DailyBriefing,
  DailyDone,
  DailyReturnPill,
  DailyWords,
} from './components/DailyReview/DailyReview.tsx'
import { DrillPanel } from './components/Drill/DrillPanel.tsx'
import { ExamRunner, type ExamResult } from './components/Exam/ExamRunner.tsx'
import { useExamTheme } from './components/Exam/useExamTheme.ts'
import { PracticeExamPanel } from './components/Exam/PracticeExamPanel.tsx'
import { Library } from './components/Library/Library.tsx'
import type { PrimaryConsoleView } from './components/Adaptive/primaryViewTransition.ts'
import { ReflectPanel } from './components/Reflect/ReflectPanel.tsx'
import { Arena, type ArenaAnswer } from './components/Arena/Arena.tsx'
import { MistakeVault } from './components/Review/MistakeVault.tsx'
import { WordBank } from './components/WordBank/WordBank.tsx'
import { useAuthProfile } from './auth/AuthContext.tsx'
import { AnswerPass } from './components/QuestionInteraction/AnswerPass.tsx'
import { QuestionInteraction } from './components/QuestionInteraction/QuestionInteraction.tsx'
import { firstPassAttempt } from './components/QuestionInteraction/model.ts'
import { SessionSummary } from './components/SessionSummary/SessionSummary.tsx'
import { loadQuestions } from './data/questions.ts'
import {
  DEFAULT_DRILL_SETUP,
  lastSeenAt,
  normalizeDrillSetup,
  type DrillSetup,
} from './drill/setup.ts'
import {
  drillToPracticeExam,
  toSourceLetter,
  type DrillExam,
} from './drill/examAdapter.ts'
import { normalizeProgression, type ProgressionState } from './progression/model.ts'
import { buildTaxonomy } from './progression/questions.ts'
import {
  buildDailyPlan,
  completeDay,
  liveStreak,
  markPrompted,
  shouldPrompt,
  type DailyPlan,
  type DailyState,
} from './review/daily.ts'
import { applyReview, isClean, scheduleMistake } from './review/schedule.ts'
import { buildStream, type StreamItem } from './review/stream.ts'
import {
  getActiveView,
  getAttempts,
  getDailyState,
  getDrillSetup,
  getProgression,
  getReview,
  getReviews,
  getSettings,
  getWordBankEntries,
  now,
  recordAttempt,
  saveDailyState,
  saveDrillSetup,
  saveProgression,
  saveReview,
  setActiveView,
  setTimeLimit,
  setTimedMode,
} from './storage/index.ts'
import type { Level } from './progression/config.ts'
import type { Attempt, FirstPass, MissSource, Question } from './types.ts'
import './app.css'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'
type View =
  | 'adaptive'
  | 'lessons'
  | 'browse'
  | 'practice'
  | 'drill'
  | 'exam'
  | 'reviews'
  | 'reflect'
  | 'arena'
  | 'words'

const VALID_VIEWS: View[] = [
  'adaptive',
  'lessons',
  'browse',
  'practice',
  'drill',
  'exam',
  'reviews',
  'reflect',
  'arena',
  'words',
]

function isView(value: unknown): value is View {
  return typeof value === 'string' && VALID_VIEWS.includes(value as View)
}

// The adaptive experience names its units by what they are for; the queue names
// them by where the student was when the miss happened.
const MISS_SOURCE_BY_ACTIVITY: Record<'diagnostic' | 'skill' | 'checkpoint', MissSource> = {
  diagnostic: 'diagnostic',
  skill: 'skill-quiz',
  checkpoint: 'checkpoint',
}

type SessionPhase = 'answer' | 'review-intro' | 'review' | 'summary'

type DailyPhase = 'hidden' | 'briefing' | 'words' | 'done'

// What the current daily run promised, so the closing card can report on it
// after the queue itself has moved on.
type DailyRun = { questions: number; wordsTotal: number; wordsKnew: number }

function App() {
  const { displayName } = useAuthProfile()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [viewState, setViewState] = useState<View>(() => {
    const saved = getActiveView<View>()
    return isView(saved) ? saved : 'adaptive'
  })

  function setView(nextView: View) {
    setActiveView(nextView)
    setViewState(nextView)
  }

  const view = viewState
  const [progression, setProgression] = useState<ProgressionState | null>(null)

  const [stream, setStream] = useState<StreamItem[]>([])
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('answer')
  const [answerIndex, setAnswerIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, FirstPass>>({})
  const [reviewList, setReviewList] = useState<StreamItem[]>([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [sessionAttempts, setSessionAttempts] = useState<Attempt[]>([])

  // A drill is the same session engine, sat in the exam's surface: the whole
  // set is answered full-screen under a per-question clock, nothing is revealed
  // until the last question is behind you, and then every question - right or
  // wrong - is reviewed.
  const [sessionKind, setSessionKind] = useState<'standard' | 'drill'>('standard')
  const [sessionClock, setSessionClock] = useState<{ timed: boolean; limitSec: number } | null>(null)
  const [drillId, setDrillId] = useState<string | null>(null)
  const [drillExam, setDrillExam] = useState<DrillExam | null>(null)
  const [drillSetup, setDrillSetupState] = useState<DrillSetup>(
    () => normalizeDrillSetup(getDrillSetup()),
  )

  const [examTheme, setExamTheme] = useExamTheme()
  const [demoMode, setDemoModeState] = useState(false)
  const [timedMode, setTimedModeState] = useState(false)
  const [timeLimitSec, setTimeLimitState] = useState(90)
  const [reviewsVersion, setReviewsVersion] = useState(0)

  // The daily return: one briefing per day, then questions, then words.
  const [dailyPhase, setDailyPhase] = useState<DailyPhase>('hidden')
  const [dailyState, setDailyStateValue] = useState<DailyState>(() => getDailyState())
  const [dailyRun, setDailyRun] = useState<DailyRun | null>(null)

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

  // Re-read the queue whenever it changes or the student moves between views - 
  // the vault and the due badge must never show a stale count.
  const reviewSnapshot = useMemo(() => {
    void reviewsVersion
    void view
    return { reviews: getReviews(), at: now() }
  }, [reviewsVersion, view])

  const dueNow = useMemo(
    () =>
      Object.values(reviewSnapshot.reviews).filter(
        (item) => item.stage >= 0 && item.dueAt <= reviewSnapshot.at,
      ).length,
    [reviewSnapshot],
  )

  // Freshness for drills: the last time each question was answered, so a
  // repeat drill on the same target works through the bank instead of dealing
  // the same ten questions again.
  const drillSeen = useMemo(() => {
    void reviewsVersion
    void view
    return lastSeenAt(getAttempts())
  }, [reviewsVersion, view])

  // Everything still on the ladder, due or not - what the vault would show if
  // you opened it right now. A retired question (stage -1) is off the books.
  const filedNow = useMemo(
    () => Object.values(reviewSnapshot.reviews).filter((item) => item.stage >= 0).length,
    [reviewSnapshot],
  )

  // Everything the ladder owes today, on both tracks, grouped by how long each
  // item has been away.
  const dailyPlan = useMemo<DailyPlan>(
    () =>
      buildDailyPlan(
        questions,
        reviewSnapshot.reviews,
        getWordBankEntries(),
        reviewSnapshot.at,
        demoMode,
      ),
    [questions, reviewSnapshot, demoMode],
  )

  // Fires once per day, and only when the day actually owes something. Marking
  // the prompt before showing it means "Not now" is respected until tomorrow.
  useEffect(() => {
    if (loadState !== 'ready') return
    if (dailyPhase !== 'hidden' || dailyRun) return
    if (!shouldPrompt(dailyState, dailyPlan)) return
    const next = markPrompted(dailyState, dailyPlan.day)
    saveDailyState(next)
    setDailyStateValue(next)
    setDailyPhase('briefing')
  }, [loadState, dailyPhase, dailyRun, dailyState, dailyPlan])

  function startDailyReturn() {
    setDailyRun({
      questions: dailyPlan.questions.length,
      wordsTotal: dailyPlan.words.length,
      wordsKnew: 0,
    })
    if (dailyPlan.questions.length > 0) {
      setDailyPhase('hidden')
      startSession(dailyPlan.questions)
    } else {
      setDailyPhase('words')
    }
  }

  function finishDailyReturn(wordsKnew: number) {
    const next = completeDay(dailyState, dailyPlan.day)
    saveDailyState(next)
    setDailyStateValue(next)
    setDailyRun((run) => (run ? { ...run, wordsKnew } : run))
    setDailyPhase('done')
    setReviewsVersion((version) => version + 1)
  }

  function leaveDailyReturn() {
    setDailyPhase('hidden')
    setDailyRun(null)
    setView('adaptive')
  }

  type SessionOptions = {
    kind?: 'standard' | 'drill'
    clock?: { timed: boolean; limitSec: number } | null
    activityId?: string | null
  }

  function startSession(subset: Question[], options: SessionOptions = {}) {
    setStream(buildStream(subset, getReviews(), now()))
    setAnswerIndex(0)
    setAnswers({})
    setReviewList([])
    setReviewIndex(0)
    setSessionAttempts([])
    setSessionPhase('answer')
    setSessionKind(options.kind ?? 'standard')
    setSessionClock(options.clock ?? null)
    setDrillId(options.activityId ?? null)
    setDrillExam(null)
    setView('practice')
  }

  function changeDrillSetup(next: DrillSetup) {
    saveDrillSetup(next)
    setDrillSetupState(next)
  }

  // The drill set is chosen against the target, then handed to the same stream
  // builder as any other set, so a question that happens to be due resurfaces
  // shuffled inside the drill instead of being counted twice. The stream is
  // built here rather than inside startSession because the exam runner needs
  // the finished order - and the shuffle each item was dealt with - to draw it.
  function startDrill(setup: DrillSetup, drillQuestions: Question[]) {
    changeDrillSetup(setup)
    const activityId = `drill:${Date.now()}`
    const nextStream = buildStream(drillQuestions, getReviews(), now())
    setStream(nextStream)
    setAnswerIndex(0)
    setAnswers({})
    setReviewList([])
    setReviewIndex(0)
    setSessionAttempts([])
    setSessionPhase('answer')
    setSessionKind('drill')
    setSessionClock(
      setup.secondsPerQuestion === null
        ? { timed: false, limitSec: timeLimitSec }
        : { timed: true, limitSec: setup.secondsPerQuestion },
    )
    setDrillId(activityId)
    setDrillExam(drillToPracticeExam(nextStream, setup, activityId))
    setView('practice')
  }

  // The drill is over. Every answer the runner collected is turned into the
  // same first-pass record the ordinary answer pass produces, then the whole
  // set - not only the misses - goes to review.
  function finishDrillRun(result: ExamResult, converted: DrillExam) {
    const collected: Record<string, FirstPass> = {}
    for (const item of stream) {
      const id = item.question.id
      const chosen = toSourceLetter(converted, id, result.answers[id] ?? '')
      const seconds = result.questionSeconds[id]
      collected[id] = {
        chosen,
        confidence: null,
        correct: chosen !== '' && chosen === item.question.answer,
        timeMs: seconds === undefined ? null : seconds * 1000,
        // Only a question left blank was beaten by the clock. A choice that was
        // selected when time ran out is an answer, and counts as one.
        timedOut: chosen === '',
        struckChoices: [],
      }
    }
    setAnswers(collected)
    setDrillExam(null)
    // Nothing is finalized here: a drill reviews every question it dealt, so
    // each one is logged on the way out of its own review screen.
    setReviewList([...stream])
    setReviewIndex(0)
    setSessionPhase(stream.length === 0 ? 'summary' : 'review-intro')
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
        saveReview({
          ...scheduleMistake(
            getReview(question.id),
            question.id,
            'miss',
            getSettings().demoMode,
            scheduleTime,
          ),
          source: MISS_SOURCE_BY_ACTIVITY[activityKind],
        })
        scheduled = true
      }
    })

    if (scheduled) setReviewsVersion((version) => version + 1)
    return references
  }

  // A battle is still practice: every answer is logged, and every miss is filed
  // into the same queue as any other, so the vault and the daily return stay the
  // complete record rather than skipping whatever happened in the Arena.
  function recordArenaAnswers(matchId: string, answers: ArenaAnswer[]) {
    const timestamp = Date.now()
    const scheduleTime = now()
    let scheduled = false

    answers.forEach((answer, index) => {
      const reviewStage = getReview(answer.question.id)?.stage ?? 0
      recordAttempt({
        questionId: answer.question.id,
        timestamp: timestamp + index,
        chosen: answer.chosen,
        correct: answer.correct,
        confidence: null,
        attemptsToCorrect: answer.correct ? 1 : 0,
        errorCause: null,
        selfExplanations: null,
        evidenceUnderlined: [],
        evidenceScore: null,
        chainBreakLink: null,
        trapGuess: null,
        trapActual: null,
        hiddenError: false,
        resurrectionStage: reviewStage,
        timeSpentMs: answer.elapsedMs,
        // An unanswered question ran out of clock; nothing else can leave it blank.
        timedOut: answer.chosen === '',
        activityId: `arena:${matchId}`,
      })

      if (!answer.correct) {
        saveReview({
          ...scheduleMistake(
            getReview(answer.question.id),
            answer.question.id,
            answer.chosen === '' ? 'timeout' : 'miss',
            getSettings().demoMode,
            scheduleTime,
          ),
          source: 'arena',
        })
        scheduled = true
      }
    })

    if (scheduled) setReviewsVersion((version) => version + 1)
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
    const inDrill = sessionKind === 'drill'
    const logged = inDrill && drillId ? { ...attempt, activityId: drillId } : attempt
    recordAttempt(logged)
    setSessionAttempts((prev) => [...prev, logged])

    const demo = getSettings().demoMode
    const existing = getReview(attempt.questionId)
    const nowTs = now()

    if (item.isReview && existing) {
      saveReview(applyReview(existing, isClean(attempt.correct), demo, nowTs))
    } else if (attempt.timedOut) {
      saveReview({
        ...scheduleMistake(existing, attempt.questionId, 'timeout', demo, nowTs),
        source: inDrill ? 'drill' : 'practice',
      })
    } else if (!attempt.correct) {
      saveReview({
        ...scheduleMistake(existing, attempt.questionId, 'miss', demo, nowTs),
        source: inDrill ? 'drill' : 'practice',
      })
    }
    setReviewsVersion((v) => v + 1)
  }

  function handleAnswer(firstPass: FirstPass) {
    const item = stream[answerIndex]
    const next = { ...answers, [item.question.id]: firstPass }
    setAnswers(next)
    advanceAnswerPass(next)
  }

  function advanceAnswerPass(allAnswers: Record<string, FirstPass>) {
    if (answerIndex + 1 < stream.length) {
      setAnswerIndex((i) => i + 1)
    } else {
      finishAnswerPass(allAnswers)
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

  function toggleTimed() {
    const next = !timedMode
    setTimedMode(next)
    setTimedModeState(next)
  }
  function changeLimit(sec: number) {
    setTimeLimit(sec)
    setTimeLimitState(sec)
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


  // Step two of the daily return, and its closing card. Both are full
  // activities rather than modals - only the briefing interrupts.
  if (dailyPhase === 'words') {
    return (
      <>
        <DailyWords
          plan={dailyPlan}
          onFinish={finishDailyReturn}
          onLeave={leaveDailyReturn}
        />
      </>
    )
  }

  if (dailyPhase === 'done') {
    return (
      <>
        <DailyDone
          questionsCleared={dailyRun?.questions ?? 0}
          wordsRecalled={dailyRun?.wordsKnew ?? 0}
          wordsTotal={dailyRun?.wordsTotal ?? 0}
          streak={dailyState.streak}
          onClose={leaveDailyReturn}
        />
      </>
    )
  }

  const dailyOverlay = (
    <>
      {dailyPhase === 'briefing' && (
        <DailyBriefing
          plan={dailyPlan}
          at={reviewSnapshot.at}
          streak={liveStreak(dailyState, dailyPlan.day)}
          onStart={startDailyReturn}
          onDismiss={() => setDailyPhase('hidden')}
        />
      )}
      {dailyPhase === 'hidden' &&
        !dailyRun &&
        view !== 'practice' &&
        view !== 'reflect' &&
        dailyPlan.total > 0 &&
        dailyState.lastCompletedDay !== dailyPlan.day && (
          <DailyReturnPill
            count={dailyPlan.total}
            onOpen={() => setDailyPhase('briefing')}
          />
        )}
    </>
  )

  if (view !== 'practice') {
    const PRIMARY_VIEW_BY_VIEW: Partial<Record<View, PrimaryConsoleView>> = {
      lessons: 'lessons',
      drill: 'drill',
      exam: 'exam',
      reviews: 'reviews',
      reflect: 'reflect',
      arena: 'arena',
      words: 'words',
      browse: 'library',
    }
    const primaryView: PrimaryConsoleView = PRIMARY_VIEW_BY_VIEW[view] ?? 'practice'

    return (
      <>
        <AdaptiveExperience
          primaryView={primaryView}
          examPanel={(
            <PracticeExamPanel
              onBack={() => setView('adaptive')}
              onOpenWords={() => setView('words')}
            />
          )}
          drillPanel={(
            <DrillPanel
              questions={questions}
              seen={drillSeen}
              setup={drillSetup}
              onChangeSetup={changeDrillSetup}
              onStart={startDrill}
              onBack={() => setView('adaptive')}
              onOpenVault={() => setView('reviews')}
              vaultOpenCount={filedNow}
            />
          )}
          libraryPanel={(
            <Library
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
          wordsPanel={<WordBank onBack={() => setView('adaptive')} />}
          reflectPanel={(
            <ReflectPanel
              plan={dailyPlan}
              at={reviewSnapshot.at}
              streak={liveStreak(dailyState, dailyPlan.day)}
              finishedToday={dailyState.lastCompletedDay === dailyPlan.day}
              filedCount={filedNow}
              dueCount={dueNow}
              onStart={startDailyReturn}
              onOpenVault={() => setView('reviews')}
              onOpenPractice={() => setView('adaptive')}
            />
          )}
          reviewsPanel={(
            <MistakeVault
              questions={questions}
              reviews={reviewSnapshot.reviews}
              now={reviewSnapshot.at}
              onStart={startSession}
              onBack={() => setView('reflect')}
            />
          )}
          arenaPanel={(
            <Arena
              questions={questions}
              onExit={() => setView('adaptive')}
              onOpenReviews={() => setView('reviews')}
              onBattleComplete={recordArenaAnswers}
            />
          )}
          questions={questions}
          progression={progression}
          onProgressionChange={updateProgression}
          onOpenPractice={() => setView('adaptive')}
          onOpenDrill={() => setView('drill')}
          onOpenVault={() => setView('reviews')}
          onOpenExam={() => setView('exam')}
          onOpenLessons={() => setView('lessons')}
          onOpenWords={() => setView('words')}
          onOpenLibrary={() => setView('browse')}
          onOpenReflect={() => setView('reflect')}
          onOpenArena={() => setView('arena')}
          onRecordAnswers={recordAdaptiveAnswers}
          onRecordReview={recordAdaptiveReview}
        />
        {dailyOverlay}
      </>
    )
  }

  // --- Practice (two-pass) --------------------------------------------------

  if (sessionPhase === 'summary') {
    // Mid-run during a daily return, the summary is a landing, not an ending:
    // the words saved alongside these questions are still waiting.
    const wordsLeft = dailyRun?.wordsTotal ?? 0
    const daily = dailyRun
      ? wordsLeft > 0
        ? {
            label: `Next: ${wordsLeft} ${wordsLeft === 1 ? 'word' : 'words'} from your bank`,
            action: () => {
              setView('adaptive')
              setDailyPhase('words')
            },
          }
        : { label: 'Finish today’s return', action: () => finishDailyReturn(0) }
      : null

    const drillEnd = sessionKind === 'drill' && !daily

    return (
      <>
        <SessionSummary
          attempts={sessionAttempts}
          onPracticeMore={() => setView(drillEnd ? 'drill' : 'browse')}
          practiceMoreLabel={drillEnd ? 'Build another drill' : undefined}
          secondary={
            drillEnd
              ? { label: 'Open the mistake vault', action: () => setView('reviews') }
              : undefined
          }
          onDashboard={() => setView('adaptive')}
          continueLabel={daily?.label}
          onContinue={daily?.action}
        />
      </>
    )
  }

  const header = (
    <header className="app-header">
      <button
        className="wordmark wordmark--button"
        type="button"
        onClick={() => setView(sessionKind === 'drill' ? 'drill' : 'browse')}
        aria-label={sessionKind === 'drill' ? 'Back to Drills' : 'Back to Browse'}
      >
        clarity<span>.</span>
      </button>
      <button className="link-button" type="button" onClick={() => setView('adaptive')}>Dashboard</button>
    </header>
  )

  if (sessionPhase === 'review-intro') {
    // A drill reviews everything it dealt, so the count of misses can't be read
    // off the length of the review list the way it can in a practice set.
    const missed = stream.filter((item) => !answers[item.question.id]?.correct).length
    const right = stream.length - missed
    const reviewAll = sessionKind === 'drill'
    return (
      <>
        <main className="app-shell">
          {header}
          <section className="pass-intro">
            <p className="eyebrow">Answers locked in</p>
            <h1>
              {right} right, {missed} missed.
            </h1>
            <p>
              {reviewAll
                ? `No scores to chase - the value is here. You'll walk back through all ${stream.length} ${
                    stream.length === 1 ? 'question' : 'questions'
                  }: redo each one you missed and diagnose it in your own words, and read the reasoning on the ones you got right. The misses come back later, disguised, until they can't catch you.`
                : 'No scores to chase - the value is here. Redo each one you missed, diagnose it in your own words, then see the reasoning. They’ll come back later, disguised, until they can’t catch you.'}
            </p>
            <button className="button" type="button" onClick={() => setSessionPhase('review')}>
              Start the review →
            </button>
          </section>
        </main>
      </>
    )
  }

  // A drill is sat in the exam's surface: full screen, passage beside question,
  // its own clock on every question. Nothing is revealed inside it - the whole
  // set is answered first, and the review that follows covers all of it.
  if (drillExam) {
    const perQuestionSeconds = sessionClock?.timed ? sessionClock.limitSec : null
    return (
      <div className="exam-overlay" data-exam-theme={examTheme}>
        <ExamRunner
          exam={drillExam.exam}
          learnerName={displayName}
          theme={examTheme}
          timing={
            perQuestionSeconds === null
              ? { kind: 'untimed', label: 'No clock' }
              : {
                  kind: 'fixed',
                  minutesPerModule: (perQuestionSeconds * stream.length) / 60,
                  label: `${perQuestionSeconds} seconds a question`,
                }
          }
          perQuestionSeconds={perQuestionSeconds}
          persistDraft={false}
          bannerLabel="THIS IS A DRILL"
          onToggleTheme={() => setExamTheme(examTheme === 'dark' ? 'light' : 'dark')}
          onExit={() => {
            setDrillExam(null)
            setView('drill')
          }}
          onFinish={(result) => finishDrillRun(result, drillExam)}
        />
      </div>
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
            <span>{inReview ? 'Review' : 'Answer'} - {pos + 1} of {total}</span>
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
              timedMode={sessionClock ? sessionClock.timed : timedMode}
              timeLimitSec={sessionClock ? sessionClock.limitSec : timeLimitSec}
              onAnswer={handleAnswer}
            />
          )}
        </article>
      </main>
    </>
  )
}

export default App
