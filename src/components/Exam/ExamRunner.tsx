import { useEffect, useRef, useState } from 'react'
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Highlighter,
  Moon,
  MoreVertical,
  StickyNote,
  Sun,
} from 'lucide-react'

import { ExamFigure } from './ExamFigure.tsx'
import { ExamPassage } from './ExamPassage.tsx'
import { formatClock, type ExamModule, type PracticeExam } from './examData.ts'

export type ExamResult = {
  answers: Record<string, string>
  flagged: string[]
  finishedAt: number
  /** Seconds left on the clock when each module ended. */
  timeLeft: Record<string, number>
}

type ExamRunnerProps = {
  exam: PracticeExam
  learnerName: string
  theme: 'dark' | 'light'
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
  onToggleTheme,
  onExit,
  onFinish,
}: ExamRunnerProps) {
  const [moduleIndex, setModuleIndex] = useState(0)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [screen, setScreen] = useState<Screen>('module-intro')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [flagged, setFlagged] = useState<Record<string, boolean>>({})
  const [crossOuts, setCrossOuts] = useState<Record<string, string[]>>({})
  const [highlights, setHighlights] = useState<Record<string, number[]>>({})
  const [timeLeft, setTimeLeft] = useState<Record<string, number>>({})
  const [crossOutMode, setCrossOutMode] = useState(false)
  const [annotate, setAnnotate] = useState(false)
  const [timerHidden, setTimerHidden] = useState(false)
  const [directionsOpen, setDirectionsOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(
    exam.modules[0]?.durationSeconds ?? 0,
  )

  const module: ExamModule = exam.modules[moduleIndex]
  const question = module.questions[questionIndex]
  const answered = module.questions.filter(
    (item) => answers[item.id] !== undefined,
  ).length
  const lastModule = moduleIndex === exam.modules.length - 1
  const running = screen === 'question' || screen === 'review'

  // Latest-value refs keep the one-second interval from restarting (and losing
  // a tick) every time an answer changes.
  const advanceRef = useRef<() => void>(() => {})

  function finishExam(remaining: number) {
    onFinish({
      answers,
      flagged: Object.keys(flagged).filter((id) => flagged[id]),
      finishedAt: Date.now(),
      timeLeft: { ...timeLeft, [module.id]: remaining },
    })
  }

  function advanceModule() {
    const remaining = Math.max(0, secondsLeft)
    if (lastModule) {
      finishExam(remaining)
      return
    }
    setTimeLeft((current) => ({ ...current, [module.id]: remaining }))
    setModuleIndex((index) => index + 1)
    setQuestionIndex(0)
    setSecondsLeft(exam.modules[moduleIndex + 1].durationSeconds)
    setScreen('module-intro')
    setNavOpen(false)
    setMoreOpen(false)
  }

  advanceRef.current = advanceModule

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running])

  // Time is up: the module closes itself, the same way the real app does.
  useEffect(() => {
    if (!running || secondsLeft > 0) return
    advanceRef.current()
  }, [running, secondsLeft])

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
            {Math.round(module.durationSeconds / 60)} minutes. The clock starts
            when you continue and the module ends on its own when time runs out.
          </p>
          <ul className="exam-interstitial__list">
            <li>Mark questions for review and come back to them from the question list.</li>
            <li>Turn on the ABC tool to cross out answers you have ruled out.</li>
            <li>Turn on the highlighter to mark evidence in the passage.</li>
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
          <ExamPassage
            key={question.id}
            paragraphs={question.passage}
            highlights={highlights[question.id] ?? []}
            annotate={annotate}
            onHighlightChange={(indices) =>
              setHighlights((current) => ({ ...current, [question.id]: indices }))
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

          <p className="exam-stem">{question.stem}</p>

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
                    <span className="exam-choice__text">{choice.text}</span>
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
    </div>
  )
}
