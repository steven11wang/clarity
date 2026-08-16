import { useEffect, useRef, useState } from 'react'
import {
  BookA,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Highlighter,
  Moon,
  MoreVertical,
  StickyNote,
  Sun,
} from 'lucide-react'

import { useWordLookup } from '../../dictionary/useWordLookup.ts'
import { ExamFigure } from './ExamFigure.tsx'
import { ExamPassage } from './ExamPassage.tsx'
import { ExamTable } from './ExamTable.tsx'
import { LookupText } from '../../dictionary/LookupText.tsx'
import { resolveChoiceContext } from '../../dictionary/context.ts'
import { WordLookupPopover } from './WordLookupPopover.tsx'
import {
  formatClock,
  moduleDurationSeconds,
  type ExamModule,
  type ExamTiming,
  type PracticeExam,
} from './examData.ts'
import {
  clearPracticeExamDraft,
  savePracticeExamDraft,
  type PracticeExamDraft,
} from '../../storage/index.ts'

export type ExamResult = {
  answers: Record<string, string>
  flagged: string[]
  finishedAt: number
  /** Seconds left on the clock when each module ended. */
  timeLeft: Record<string, number>
  /**
   * Seconds counted up per module: the spillover past the clock, or the whole
   * elapsed time when the run was untimed.
   */
  overtime: Record<string, number>
  /** Seconds the learner sat on each question, keyed by question id. */
  questionSeconds: Record<string, number>
  untimed: boolean
  timingLabel: string
  /** Question IDs that have been successfully re-done in the "Fix your misses" review loop. */
  fixedMisses?: Record<string, boolean>
  /** Question IDs that have been reviewed in the question breakdown table. */
  reviewedQuestions?: Record<string, boolean>
}

type ExamRunnerProps = {
  exam: PracticeExam
  learnerName: string
  theme: 'dark' | 'light'
  timing: ExamTiming
  paceId?: string
  customMinutes?: number
  initialDraft?: PracticeExamDraft | null
  onToggleTheme: () => void
  onExit: () => void
  onFinish: (result: ExamResult) => void
}

type Screen = 'module-intro' | 'question' | 'review'

const DIRECTIONS = [
  'The questions in this section address a number of important reading and writing skills. Each question includes one or more passages, which may include a table or graph. Read each passage and question carefully, and then choose the best answer to the question based on the passage(s).',
  'All questions in this section are multiple-choice with four answer choices. Each question has a single best answer.',
]

export function ExamRunner({
  exam,
  learnerName,
  theme,
  timing,
  paceId,
  customMinutes,
  initialDraft,
  onToggleTheme,
  onExit,
  onFinish,
}: ExamRunnerProps) {
  const [moduleIndex, setModuleIndex] = useState(
    () => Math.min(Math.max(0, initialDraft?.moduleIndex ?? 0), exam.modules.length - 1),
  )
  const [questionIndex, setQuestionIndex] = useState(
    () => Math.min(Math.max(0, initialDraft?.questionIndex ?? 0), (exam.modules[initialDraft?.moduleIndex ?? 0]?.questions.length ?? 1) - 1),
  )
  const [screen, setScreen] = useState<Screen>(
    () => initialDraft?.screen ?? 'module-intro',
  )
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => initialDraft?.answers ?? {},
  )
  const [flagged, setFlagged] = useState<Record<string, boolean>>(
    () => initialDraft?.flagged ?? {},
  )
  const [crossOuts, setCrossOuts] = useState<Record<string, string[]>>(
    () => initialDraft?.crossOuts ?? {},
  )
  const [highlights, setHighlights] = useState<Record<string, number[]>>(
    () => initialDraft?.highlights ?? {},
  )
  const [timeLeft, setTimeLeft] = useState<Record<string, number>>(
    () => initialDraft?.timeLeft ?? {},
  )
  const [overtimeLog, setOvertimeLog] = useState<Record<string, number>>(
    () => initialDraft?.overtimeLog ?? {},
  )
  const [questionSeconds, setQuestionSeconds] = useState<Record<string, number>>(
    () => initialDraft?.questionSeconds ?? {},
  )
  const [crossOutMode, setCrossOutMode] = useState(false)
  const [annotate, setAnnotate] = useState(false)
  const [dictionary, setDictionary] = useState(false)
  const [timerHidden, setTimerHidden] = useState(false)
  const [directionsOpen, setDirectionsOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(
    () => initialDraft?.secondsLeft ?? (moduleDurationSeconds(exam.modules[0], timing) ?? 0),
  )
  /** Seconds counted up: the whole run when untimed, the spillover otherwise. */
  const [extraSeconds, setExtraSeconds] = useState(
    () => initialDraft?.extraSeconds ?? 0,
  )
  const [overtimeMode, setOvertimeMode] = useState(
    () => initialDraft?.overtimeMode ?? false,
  )
  const [timeUpOpen, setTimeUpOpen] = useState(false)

  useEffect(() => {
    savePracticeExamDraft({
      examId: exam.id,
      paceId: paceId ?? initialDraft?.paceId ?? 'official',
      customMinutes: customMinutes ?? initialDraft?.customMinutes ?? 20,
      moduleIndex,
      questionIndex,
      screen,
      answers,
      flagged,
      crossOuts,
      highlights,
      timeLeft,
      overtimeLog,
      questionSeconds,
      secondsLeft,
      extraSeconds,
      overtimeMode,
      updatedAt: Date.now(),
    })
  }, [
    exam.id,
    paceId,
    customMinutes,
    initialDraft,
    moduleIndex,
    questionIndex,
    screen,
    answers,
    flagged,
    crossOuts,
    highlights,
    timeLeft,
    overtimeLog,
    questionSeconds,
    secondsLeft,
    extraSeconds,
    overtimeMode,
  ])

  const wordLookup = useWordLookup()

  const module: ExamModule = exam.modules[moduleIndex]
  const question = module.questions[questionIndex]
  const answered = module.questions.filter(
    (item) => answers[item.id] !== undefined,
  ).length
  const lastModule = moduleIndex === exam.modules.length - 1
  const running = screen === 'question' || screen === 'review'
  const untimed = timing.kind === 'untimed'
  const countingUp = untimed || overtimeMode

  // The clock ticks from an interval that outlives any one question, so the
  // question it should bill each second is read from a ref, not a closure.
  const onQuestion = screen === 'question'
  const billedQuestion = useRef<string | null>(null)
  billedQuestion.current = onQuestion ? question.id : null

  function finishExam(remaining: number) {
    clearPracticeExamDraft(exam.id)
    onFinish({
      answers,
      flagged: Object.keys(flagged).filter((id) => flagged[id]),
      finishedAt: Date.now(),
      timeLeft: { ...timeLeft, [module.id]: remaining },
      overtime: { ...overtimeLog, [module.id]: countingUp ? extraSeconds : 0 },
      questionSeconds,
      untimed,
      timingLabel: timing.label,
    })
  }

  function advanceModule() {
    const remaining = untimed ? 0 : Math.max(0, secondsLeft)
    setTimeUpOpen(false)
    if (lastModule) {
      finishExam(remaining)
      return
    }
    setTimeLeft((current) => ({ ...current, [module.id]: remaining }))
    setOvertimeLog((current) => ({
      ...current,
      [module.id]: countingUp ? extraSeconds : 0,
    }))
    setModuleIndex((index) => index + 1)
    setQuestionIndex(0)
    setSecondsLeft(moduleDurationSeconds(exam.modules[moduleIndex + 1], timing) ?? 0)
    setExtraSeconds(0)
    setOvertimeMode(false)
    setScreen('module-intro')
    setNavOpen(false)
    setMoreOpen(false)
  }

  // The dialog holds the clock: nothing ticks while the learner decides.
  const ticking = running && !timeUpOpen

  useEffect(() => {
    if (!ticking) return
    const timer = window.setInterval(() => {
      if (countingUp) setExtraSeconds((value) => value + 1)
      else setSecondsLeft((value) => Math.max(0, value - 1))
      const id = billedQuestion.current
      if (id) {
        setQuestionSeconds((current) => ({
          ...current,
          [id]: (current[id] ?? 0) + 1,
        }))
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [ticking, countingUp])

  // Time is up. Rather than closing the module the way test day does, ask:
  // keep working past the clock, or submit the section now.
  useEffect(() => {
    if (!running || untimed || overtimeMode || timeUpOpen) return
    if (secondsLeft > 0) return
    setTimeUpOpen(true)
    setNavOpen(false)
    setMoreOpen(false)
    setDirectionsOpen(false)
  }, [running, untimed, overtimeMode, timeUpOpen, secondsLeft])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setNavOpen(false)
      setMoreOpen(false)
      setDirectionsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // A definition belongs to the passage it was opened from: leaving the
  // question (or the module) closes it.
  const closeLookup = wordLookup.close
  useEffect(() => {
    closeLookup()
  }, [closeLookup, question.id, screen])

  function selectChoice(letter: string) {
    if ((crossOuts[question.id] ?? []).includes(letter)) return
    setAnswers((current) => ({ ...current, [question.id]: letter }))
  }

  function toggleCrossOut(letter: string) {
    setCrossOuts((current) => {
      const existing = current[question.id] ?? []
      const next = existing.includes(letter)
        ? existing.filter((entry) => entry !== letter)
        : [...existing, letter]
      return { ...current, [question.id]: next }
    })
    setAnswers((current) => {
      if (current[question.id] !== letter) return current
      const next = { ...current }
      delete next[question.id]
      return next
    })
  }

  function goToQuestion(index: number) {
    setQuestionIndex(index)
    setScreen('question')
    setNavOpen(false)
  }

  function goNext() {
    if (screen === 'review') {
      advanceModule()
      return
    }
    if (questionIndex + 1 < module.questions.length) {
      setQuestionIndex((index) => index + 1)
    } else {
      setScreen('review')
    }
  }

  function goBack() {
    if (screen === 'review') {
      setScreen('question')
      setQuestionIndex(module.questions.length - 1)
      return
    }
    if (questionIndex > 0) setQuestionIndex((index) => index - 1)
  }

  if (screen === 'module-intro') {
    return (
      <div className="exam-root exam-root--interstitial">
        <div className="exam-interstitial">
          <p className="exam-interstitial__eyebrow">
            {exam.section}, {module.label}
          </p>
          <h1>{module.subject}</h1>
          <p className="exam-interstitial__lead">
            {module.questions.length} questions ·{' '}
            {untimed
              ? 'no time limit, the clock counts up so you can still see your pace.'
              : `${Math.round(
                  (moduleDurationSeconds(module, timing) ?? 0) / 60,
                )} minutes (${timing.label}). The clock starts when you continue; when it runs out you choose whether to keep working or submit the section.`}
          </p>
          <ul className="exam-interstitial__list">
            <li>Mark questions for review and come back to them from the question list.</li>
            <li>Turn on the ABC tool to cross out answers you have ruled out.</li>
            <li>Turn on the highlighter to mark evidence in the passage.</li>
            <li>
              Turn on Dictionary and click a word you don’t know — save it and it lands
              in your Word Bank as a flashcard. Your score is unaffected either way.
            </li>
          </ul>
          <div className="exam-interstitial__actions">
            <button className="exam-button exam-button--primary" type="button" onClick={() => setScreen('question')}>
              {moduleIndex === 0 ? 'Begin module' : 'Continue'}
            </button>
            <button className="exam-button exam-button--ghost" type="button" onClick={onExit}>
              Leave the exam
            </button>
          </div>
        </div>
      </div>
    )
  }

  const header = (
    <header className="exam-header">
      <div className="exam-header__left">
        <h1>
          {exam.section}, {module.label}: {module.subject}
        </h1>
        <button
          className="exam-directions"
          type="button"
          aria-expanded={directionsOpen}
          onClick={() => setDirectionsOpen((open) => !open)}
        >
          Directions {directionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {directionsOpen ? (
          <div className="exam-directions__panel" role="dialog" aria-label="Directions">
            {DIRECTIONS.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <button className="exam-button exam-button--primary" type="button" onClick={() => setDirectionsOpen(false)}>
              Close
            </button>
          </div>
        ) : null}
      </div>

      <div className="exam-header__clock">
        {timerHidden ? (
          <span className="exam-clock exam-clock--hidden" aria-hidden="true">
            ⏱
          </span>
        ) : countingUp ? (
          <strong
            className={`exam-clock ${overtimeMode ? 'exam-clock--overtime' : ''}`}
            aria-live="off"
          >
            {overtimeMode ? `+${formatClock(extraSeconds)}` : formatClock(extraSeconds)}
            <small>{overtimeMode ? 'past the clock' : 'elapsed'}</small>
          </strong>
        ) : (
          <strong
            className={`exam-clock ${secondsLeft <= 300 ? 'exam-clock--warning' : ''}`}
            aria-live="off"
          >
            {formatClock(secondsLeft)}
          </strong>
        )}
        <button className="exam-hide" type="button" onClick={() => setTimerHidden((hidden) => !hidden)}>
          {timerHidden ? 'Show' : 'Hide'}
        </button>
      </div>

      <div className="exam-header__tools">
        <button
          className={`exam-tool ${annotate ? 'exam-tool--active' : ''}`}
          type="button"
          aria-pressed={annotate}
          onClick={() => setAnnotate((on) => !on)}
        >
          <span aria-hidden="true">
            <Highlighter size={18} strokeWidth={1.6} />
            <StickyNote size={18} strokeWidth={1.6} />
          </span>
          Highlights &amp; Notes
        </button>
        <button
          className={`exam-tool ${dictionary ? 'exam-tool--active' : ''}`}
          type="button"
          aria-pressed={dictionary}
          title="Click any word in the passage to see what it means"
          onClick={() => {
            setDictionary((on) => {
              if (on) wordLookup.close()
              return !on
            })
          }}
        >
          <span aria-hidden="true">
            <BookA size={18} strokeWidth={1.6} />
          </span>
          Dictionary
        </button>
        <button
          className="exam-tool"
          type="button"
          onClick={onToggleTheme}
          aria-label={
            theme === 'dark' ? 'Switch to the light test theme' : 'Switch to the dark test theme'
          }
        >
          <span aria-hidden="true">
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.6} /> : <Moon size={18} strokeWidth={1.6} />}
          </span>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <div className="exam-more">
          <button
            className="exam-tool"
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <span aria-hidden="true"><MoreVertical size={18} strokeWidth={1.6} /></span>
            More
          </button>
          {moreOpen ? (
            <div className="exam-more__menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setScreen('review') }}>
                Go to review page
              </button>
              <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); finishExam(secondsLeft) }}>
                Submit and score now
              </button>
              <button type="button" role="menuitem" onClick={onExit}>
                Exit the exam
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )

  const banner = <p className="exam-banner">THIS IS A PRACTICE TEST</p>

  const unansweredNow = module.questions.length - answered
  const timeUpDialog = timeUpOpen ? (
    <div className="exam-timeup" role="dialog" aria-modal="true" aria-labelledby="exam-timeup-title">
      <div className="exam-timeup__card">
        <p className="exam-timeup__eyebrow">Time is up</p>
        <h2 id="exam-timeup-title">{module.label} has run out of time</h2>
        <p className="exam-timeup__lead">
          {unansweredNow > 0
            ? `${unansweredNow} ${unansweredNow === 1 ? 'question is' : 'questions are'} still blank. `
            : 'Every question here has an answer. '}
          On test day the section would close now. In practice you choose: keep
          working with the clock counting up, or submit this section and move on.
        </p>
        <div className="exam-timeup__actions">
          <button
            className="exam-button exam-button--primary"
            type="button"
            onClick={() => {
              setTimeUpOpen(false)
              setOvertimeMode(true)
            }}
          >
            Keep working
          </button>
          <button
            className="exam-button exam-button--muted"
            type="button"
            onClick={advanceModule}
          >
            {lastModule ? 'Submit the exam' : 'Submit this section'}
          </button>
        </div>
        <p className="exam-timeup__note">
          Extra time is tracked per module and shown on your report.
        </p>
      </div>
    </div>
  ) : null

  const footer = (
    <footer className="exam-footer">
      <span className="exam-footer__name">{learnerName}</span>
      <div className="exam-footer__center">
        <button
          className="exam-nav-button"
          type="button"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          {screen === 'review'
            ? `${module.label} review`
            : `Question ${questionIndex + 1} of ${module.questions.length}`}
          {navOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
        {navOpen ? (
          <div className="exam-nav-panel" role="dialog" aria-label="Question list">
            <p className="exam-nav-panel__title">
              {exam.section}, {module.label}: {module.subject}
            </p>
            <div className="exam-nav-panel__legend">
              <span><i className="exam-dot exam-dot--current" /> Current</span>
              <span><i className="exam-dot exam-dot--unanswered" /> Unanswered</span>
              <span><i className="exam-dot exam-dot--flagged" /> For review</span>
            </div>
            <div className="exam-nav-grid">
              {module.questions.map((item, index) => (
                <button
                  className={[
                    'exam-nav-cell',
                    answers[item.id] ? 'exam-nav-cell--answered' : '',
                    index === questionIndex && screen === 'question' ? 'exam-nav-cell--current' : '',
                    flagged[item.id] ? 'exam-nav-cell--flagged' : '',
                  ].filter(Boolean).join(' ')}
                  type="button"
                  key={item.id}
                  onClick={() => goToQuestion(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <button
              className="exam-button exam-button--ghost"
              type="button"
              onClick={() => { setNavOpen(false); setScreen('review') }}
            >
              Go to review page
            </button>
          </div>
        ) : null}
      </div>
      <div className="exam-footer__actions">
        <button
          className="exam-button exam-button--muted"
          type="button"
          onClick={goBack}
          disabled={screen === 'question' && questionIndex === 0}
        >
          Back
        </button>
        <button className="exam-button exam-button--primary" type="button" onClick={goNext}>
          {screen === 'review' ? (lastModule ? 'Submit exam' : 'Next module') : 'Next'}
        </button>
      </div>
    </footer>
  )

  if (screen === 'review') {
    const unanswered = module.questions.length - answered
    return (
      <div className="exam-root">
        {header}
        {banner}
        <main className="exam-review">
          <h2>Check Your Work</h2>
          <p>
            On test day you won’t be able to move back and forth between modules.
            {unanswered > 0
              ? ` You have ${unanswered} unanswered ${unanswered === 1 ? 'question' : 'questions'} left in this module.`
              : ' Every question in this module has an answer.'}
          </p>
          <div className="exam-review__legend">
            <span><i className="exam-dot exam-dot--unanswered" /> Unanswered</span>
            <span><i className="exam-dot exam-dot--flagged" /> For review</span>
          </div>
          <div className="exam-nav-grid exam-nav-grid--review">
            {module.questions.map((item, index) => (
              <button
                className={[
                  'exam-nav-cell',
                  answers[item.id] ? 'exam-nav-cell--answered' : '',
                  flagged[item.id] ? 'exam-nav-cell--flagged' : '',
                ].filter(Boolean).join(' ')}
                type="button"
                key={item.id}
                onClick={() => goToQuestion(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </main>
        {footer}
        {timeUpDialog}
      </div>
    )
  }

  const struck = crossOuts[question.id] ?? []

  return (
    <div className="exam-root">
      {header}
      {banner}

      <main className="exam-body">
        <section className="exam-pane exam-pane--passage" aria-label="Passage">
          {question.figure ? <ExamFigure figure={question.figure} /> : null}
          {question.table ? <ExamTable table={question.table} /> : null}
          <ExamPassage
            key={question.id}
            paragraphs={question.passage}
            highlights={highlights[question.id] ?? []}
            annotate={annotate}
            onHighlightChange={(indices) =>
              setHighlights((current) => ({ ...current, [question.id]: indices }))
            }
            dictionary={dictionary}
            onLookup={(request) =>
              wordLookup.open({
                ...request,
                source: { examId: exam.id, questionId: question.id },
              })
            }
          />
        </section>

        <div className="exam-divider" aria-hidden="true"><span /></div>

        <section className="exam-pane exam-pane--question" aria-label="Question">
          <div className="exam-question-bar">
            <span className="exam-question-number">{questionIndex + 1}</span>
            <button
              className={`exam-mark ${flagged[question.id] ? 'exam-mark--on' : ''}`}
              type="button"
              aria-pressed={Boolean(flagged[question.id])}
              onClick={() =>
                setFlagged((current) => ({
                  ...current,
                  [question.id]: !current[question.id],
                }))
              }
            >
              <Bookmark size={17} strokeWidth={1.7} fill={flagged[question.id] ? 'currentColor' : 'none'} />
              Mark for Review
            </button>
            <button
              className={`exam-abc ${crossOutMode ? 'exam-abc--on' : ''}`}
              type="button"
              aria-pressed={crossOutMode}
              aria-label="Toggle answer cross-out tool"
              onClick={() => setCrossOutMode((on) => !on)}
            >
              ABC
            </button>
          </div>

          <p className="exam-stem">
            <LookupText
              text={question.stem}
              dictionary={dictionary}
              onLookup={(request) =>
                wordLookup.open({
                  ...request,
                  source: { examId: exam.id, questionId: question.id },
                })
              }
            />
          </p>

          <ul className="exam-choices">
            {question.choices.map((choice) => {
              const selected = answers[question.id] === choice.letter
              const isStruck = struck.includes(choice.letter)
              return (
                <li key={choice.letter}>
                  <button
                    className={[
                      'exam-choice',
                      selected ? 'exam-choice--selected' : '',
                      isStruck ? 'exam-choice--struck' : '',
                    ].filter(Boolean).join(' ')}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectChoice(choice.letter)}
                  >
                    <span className="exam-choice__letter">{choice.letter}</span>
                    <span className="exam-choice__text">
                      <LookupText
                        text={choice.text}
                        dictionary={dictionary}
                        onLookup={(request) =>
                          wordLookup.open({
                            ...request,
                            sentence: resolveChoiceContext({
                              choiceText: choice.text,
                              word: request.word,
                              requestSentence: request.sentence,
                              passage: question.passage,
                              prompt: question.stem,
                            }),
                            source: { examId: exam.id, questionId: question.id },
                          })
                        }
                      />
                    </span>
                  </button>
                  {crossOutMode ? (
                    <button
                      className={`exam-strike ${isStruck ? 'exam-strike--on' : ''}`}
                      type="button"
                      onClick={() => toggleCrossOut(choice.letter)}
                      aria-label={
                        isStruck
                          ? `Undo cross out for choice ${choice.letter}`
                          : `Cross out choice ${choice.letter}`
                      }
                    >
                      {isStruck ? 'Undo' : choice.letter}
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      </main>

      {footer}
      <WordLookupPopover
        state={wordLookup.state}
        onClose={wordLookup.close}
        onToggleSave={wordLookup.toggleSave}
        onRetry={wordLookup.retry}
      />
      {timeUpDialog}
    </div>
  )
}
