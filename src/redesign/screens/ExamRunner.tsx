// Test day. Everything the rest of the game does loudly, this does quietly:
// plain paper instead of grid, no XP, no stamps, no sound, no feedback until
// the module is submitted. What it keeps from Bluebook is what helps under a
// clock: a timer you can hide, a five-minute warning, mark-for-review flags,
// crossing out choices, and a grid to jump between questions.

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, ChevronUp, Eye, EyeOff, LogOut } from 'lucide-react'

import { examAssetPath, formatClock } from '../../components/Exam/examData.ts'
import { skillBreakdown } from '../../components/Exam/examScore.ts'
import { DOMAINS } from '../game/content.ts'
import { bumpQuest, fileMiss, gain, logPage, markStudied, recordAnswer } from '../game/engine.ts'
import {
  examTitle,
  loadPracticeExam,
  moduleSeconds,
  recordResult,
  rememberExamQuestions,
  saveSitting,
  scaledScore,
  toQuestion,
  useExams,
  type ExamQuestion,
  type ExamResult,
  type PracticeExam,
  type Sitting,
} from '../game/exams.ts'
import { updateGame, useGame, useToday } from '../game/store.ts'
import { go } from '../router.ts'
import { setQuiet } from '../sound.ts'
import { INK_VAR } from '../components/Glyphs.tsx'
import { Blanks, Rich } from '../components/QuestionSheet.tsx'
import { Logo } from '../components/Logo.tsx'
import { Tangyuan } from '../components/Tangyuan.tsx'

export function ExamRunner({ examId }: { examId: string }) {
  const { sitting } = useExams()
  const [exam, setExam] = useState<PracticeExam | null>(null)
  const [failed, setFailed] = useState(false)
  const [report, setReport] = useState<{ result: ExamResult; answers: Record<string, string> } | null>(null)
  const [onBreak, setOnBreak] = useState(false)

  // test day is silent, whatever the sound switch says
  useEffect(() => {
    setQuiet(true)
    return () => setQuiet(false)
  }, [])

  useEffect(() => {
    loadPracticeExam(examId).then(setExam, () => setFailed(true))
  }, [examId])

  useEffect(() => {
    if (!sitting && !report) go('/exams')
  }, [sitting, report])

  if (failed) {
    return (
      <div className="exam exam--message">
        <p>That test didn’t load. Check your connection and try again.</p>
        <button type="button" className="btn" onClick={() => go('/exams')}>
          Back to exams
        </button>
      </div>
    )
  }
  if (report && exam) return <ExamReport exam={exam} result={report.result} answers={report.answers} />
  if (!exam || !sitting || sitting.examId !== examId) {
    return (
      <div className="exam exam--message">
        <Tangyuan mood="think" size={90} />
        <p className="hand">laying out the test booklet…</p>
      </div>
    )
  }
  if (onBreak) {
    return (
      <div className="exam exam--message">
        <Tangyuan mood="happy" size={110} />
        <h1 className="title">Module 1 is in.</h1>
        <p>Module 2 starts when you’re ready. Its clock begins when you press start.</p>
        <button type="button" className="btn btn--lg" onClick={() => setOnBreak(false)}>
          Start module 2 <ArrowRight />
        </button>
      </div>
    )
  }
  return (
    <Sitting
      key={sitting.module}
      exam={exam}
      sitting={sitting}
      onModuleDone={() => setOnBreak(true)}
      onFinished={(result, answers) => setReport({ result, answers })}
    />
  )
}

// ---------------------------------------------------------------------------

function Sitting({
  exam,
  sitting,
  onModuleDone,
  onFinished,
}: {
  exam: PracticeExam
  sitting: Sitting
  onModuleDone: () => void
  onFinished: (result: ExamResult, answers: Record<string, string>) => void
}) {
  const day = useToday()
  const module = exam.modules[sitting.module]
  const total = module.questions.length
  const [index, setIndex] = useState(sitting.index)
  const [answers, setAnswers] = useState(sitting.answers)
  const [marked, setMarked] = useState<string[]>(sitting.marked)
  const [struck, setStruck] = useState<Record<string, string[]>>({})
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => sitting.secondsLeft ?? moduleSeconds(module.durationSeconds, sitting.pace))
  const [hideClock, setHideClock] = useState(false)
  const [gridOpen, setGridOpen] = useState(false)
  const latest = useRef({ index, answers, marked, secondsLeft })
  latest.current = { index, answers, marked, secondsLeft }
  const done = useRef(false)

  const persist = () => {
    const now = latest.current
    saveSitting({ ...sitting, index: Math.min(now.index, total - 1), answers: now.answers, marked: now.marked, secondsLeft: now.secondsLeft })
  }

  // save on every change of answer or flag, and every ten seconds of clock
  useEffect(persist, [answers, marked]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (secondsLeft === null) return
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => (value === null ? null : Math.max(0, value - 1)))
    }, 1000)
    const saver = window.setInterval(persist, 10_000)
    return () => {
      window.clearInterval(timer)
      window.clearInterval(saver)
      if (!done.current) persist()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (secondsLeft === 0) submitModule()
  }, [secondsLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  const onReview = index >= total
  const question = module.questions[Math.min(index, total - 1)]

  const pick = (letter: string) => setAnswers((current) => ({ ...current, [question.id]: letter }))
  const toggleMark = () => setMarked((list) => (list.includes(question.id) ? list.filter((id) => id !== question.id) : [...list, question.id]))
  const toggleStrike = (letter: string) =>
    setStruck((all) => {
      const list = all[question.id] ?? []
      return { ...all, [question.id]: list.includes(letter) ? list.filter((l) => l !== letter) : [...list, letter] }
    })

  function submitModule() {
    if (done.current) return
    done.current = true
    if (sitting.module + 1 < exam.modules.length) {
      onModuleDone()
      saveSitting({ ...sitting, module: sitting.module + 1, index: 0, answers: latest.current.answers, marked: [], secondsLeft: null })
      return
    }
    finish(latest.current.answers)
  }

  function finish(finalAnswers: Record<string, string>) {
    const all = exam.modules.flatMap((item) => item.questions)
    const keyed = all.filter((item) => item.answer !== null)
    const wrongQs = keyed.filter((item) => finalAnswers[item.id] !== item.answer)
    const domains = skillBreakdown(exam, finalAnswers)
    const result: ExamResult = {
      examId: exam.id,
      pace: sitting.pace,
      finishedAt: Date.now(),
      correct: keyed.length - wrongQs.length,
      total: keyed.length,
      scaled: scaledScore(wrongQs.length),
      byDomain: domains.map((domain) => ({ name: domain.name, correct: domain.correct, total: domain.scored })),
      wrong: wrongQs.map((item) => item.id),
      secondsUsed: Math.round((Date.now() - sitting.startedAt) / 1000),
    }
    // every answered miss becomes a comeback (a blank is pacing, not a gap in
    // knowledge, so it is counted but not clipped), and the sitting counts as a day's page
    const asQuestions = wrongQs.filter((item) => finalAnswers[item.id]).map((item) => toQuestion(exam, item))
    rememberExamQuestions(asQuestions)
    updateGame((state) => {
      let next = state
      keyed.forEach((item) => {
        next = recordAnswer(next, item.subtopic ?? 'Words in Context', finalAnswers[item.id] === item.answer)
      })
      asQuestions.forEach((item) => {
        next = fileMiss(next, item.id, item.skill, day)
      })
      next = gain(next, 100, 8)
      next = markStudied(next, day)
      next = logPage(next, day, 100)
      next = bumpQuest(bumpQuest(next, 'turn-in-page'), 'earn-xp', 100)
      return { ...next, packs: next.packs + 2 }
    })
    // hand the report over before the sitting is cleared, so the page never blinks back to the hall
    onFinished(result, finalAnswers)
    recordResult(result)
  }

  const answeredCount = module.questions.filter((item) => answers[item.id]).length
  const lowTime = secondsLeft !== null && secondsLeft <= 300

  return (
    <div className="exam">
      <header className="exam__bar">
        <div className="exam__where">
          <Logo compact />
          <span>
            <b>{examTitle(exam.id)}</b>
            <span className="exam__module">
              Module {sitting.module + 1} of {exam.modules.length}
            </span>
          </span>
        </div>
        <div className={`exam__clock ${lowTime ? 'is-low' : ''}`} aria-live={lowTime ? 'polite' : 'off'}>
          {secondsLeft === null ? (
            <span className="exam__untimed">Untimed</span>
          ) : hideClock ? (
            <span className="exam__hidden">Clock hidden</span>
          ) : (
            <span className="num">{formatClock(secondsLeft)}</span>
          )}
          {secondsLeft !== null && (
            <button type="button" className="exam__tool" onClick={() => setHideClock(!hideClock)} aria-pressed={hideClock}>
              {hideClock ? <Eye size={16} /> : <EyeOff size={16} />} {hideClock ? 'Show' : 'Hide'}
            </button>
          )}
        </div>
        <button
          type="button"
          className="exam__tool exam__leave"
          onClick={() => {
            persist()
            go('/exams')
          }}
        >
          <LogOut size={16} /> Save &amp; leave
        </button>
      </header>
      {lowTime && secondsLeft !== null && secondsLeft > 0 && !hideClock && <div className="exam__warning">Five minutes or less left in this module.</div>}

      {onReview ? (
        <main className="exam__review">
          <h1 className="title">Check your work</h1>
          <p>
            {answeredCount} of {total} answered. Flagged questions have a tab. Submitting ends Module {sitting.module + 1}; you can’t come back to it.
          </p>
          <Grid module={module} answers={answers} marked={marked} current={-1} onJump={(i) => setIndex(i)} />
          <div className="exam__review-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setIndex(total - 1)}>
              <ArrowLeft /> Back to question {total}
            </button>
            <button type="button" className="btn btn--lg" onClick={submitModule}>
              Submit module {sitting.module + 1} <ArrowRight />
            </button>
          </div>
        </main>
      ) : (
        <main className="exam__body">
          <section className="exam__read" aria-label="Passage">
            {question.table && <ExamTableView table={question.table} />}
            {question.figure && (
              <figure className="exam__figure">
                <img src={examAssetPath(question.figure.src)} alt={question.figure.alt} />
              </figure>
            )}
            {question.passage.map((paragraph, i) => (
              <p key={i}>
                <Blanks text={paragraph} />
              </p>
            ))}
          </section>
          <section className="exam__answer" aria-label={`Question ${index + 1}`}>
            <div className="exam__qhead">
              <span className="exam__qnum num">{index + 1}</span>
              <button type="button" className={`exam__mark ${marked.includes(question.id) ? 'is-on' : ''}`} onClick={toggleMark} aria-pressed={marked.includes(question.id)}>
                {marked.includes(question.id) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />} Mark for review
              </button>
            </div>
            <p className="qsheet__prompt">
              <Rich text={question.stem} />
            </p>
            <div className="choices" role="radiogroup" aria-label="Answer choices">
              {question.choices.map((choice) => {
                const isPicked = answers[question.id] === choice.letter
                const isStruck = (struck[question.id] ?? []).includes(choice.letter)
                return (
                  <div key={choice.letter} className={`choice ${isPicked ? 'is-picked' : ''} ${isStruck ? 'is-struck' : ''}`}>
                    <button type="button" role="radio" aria-checked={isPicked} className="choice__hit" onClick={() => pick(choice.letter)}>
                      <span className="bubble">{choice.letter}</span>
                      <span className="choice__text">
                        <Rich text={choice.text} />
                      </span>
                    </button>
                    <button
                      type="button"
                      className="choice__strike"
                      aria-label={isStruck ? `Bring back choice ${choice.letter}` : `Cross out choice ${choice.letter}`}
                      aria-pressed={isStruck}
                      onClick={() => toggleStrike(choice.letter)}
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M3 10 H17" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        </main>
      )}

      <footer className="exam__foot">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
          <ArrowLeft /> Back
        </button>
        <div className="exam__nav">
          <button type="button" className="exam__navbtn" onClick={() => setGridOpen(!gridOpen)} aria-expanded={gridOpen}>
            {onReview ? 'Review' : `Question ${index + 1} of ${total}`} <ChevronUp size={16} className={gridOpen ? '' : 'is-flipped'} />
          </button>
          {gridOpen && (
            <div className="exam__popover" role="dialog" aria-label="Jump to a question">
              <Grid
                module={module}
                answers={answers}
                marked={marked}
                current={index}
                onJump={(i) => {
                  setIndex(i)
                  setGridOpen(false)
                }}
              />
              <button
                type="button"
                className="btn btn--sm btn--block"
                onClick={() => {
                  setIndex(total)
                  setGridOpen(false)
                }}
              >
                Go to review
              </button>
            </div>
          )}
        </div>
        {onReview ? (
          <span />
        ) : (
          <button type="button" className="btn btn--sm" onClick={() => setIndex(index + 1)}>
            {index === total - 1 ? 'Review' : 'Next'} <ArrowRight />
          </button>
        )}
      </footer>
    </div>
  )
}

function Grid({ module, answers, marked, current, onJump }: { module: PracticeExam['modules'][number]; answers: Record<string, string>; marked: string[]; current: number; onJump: (index: number) => void }) {
  return (
    <ol className="exam__grid">
      {module.questions.map((item, i) => (
        <li key={item.id}>
          <button
            type="button"
            className={`bubble exam__cell ${answers[item.id] ? 'is-filled' : ''} ${i === current ? 'is-here' : ''} ${marked.includes(item.id) ? 'is-marked' : ''}`}
            onClick={() => onJump(i)}
            aria-label={`Question ${i + 1}${answers[item.id] ? ', answered' : ', unanswered'}${marked.includes(item.id) ? ', marked for review' : ''}`}
          >
            {i + 1}
          </button>
        </li>
      ))}
    </ol>
  )
}

function ExamTableView({ table }: { table: NonNullable<ExamQuestion['table']> }) {
  return (
    <table className="exam__table">
      {table.caption && <caption>{table.caption}</caption>}
      <thead>
        <tr>
          {table.headers.map((header, i) => (
            <th key={i}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (
              <td key={c}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---------------------------------------------------------------------------

function ExamReport({ exam, result, answers }: { exam: PracticeExam; result: ExamResult; answers: Record<string, string> }) {
  const game = useGame()
  const [openId, setOpenId] = useState<string | null>(null)
  const target = Math.round(game.targetScore / 2 / 10) * 10
  const missed = useMemo(
    () => exam.modules.flatMap((module) => module.questions.filter((question) => result.wrong.includes(question.id) && answers[question.id])),
    [exam, result, answers],
  )
  const blanks = result.wrong.length - missed.length
  const inkFor = (name: string) => INK_VAR[DOMAINS.find((domain) => domain.name === name)?.ink ?? 'yellow']

  useEffect(() => {
    setQuiet(false)
  }, [])

  return (
    <div className="exam-report">
      <header className="exam-report__head">
        <Logo />
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => go('/exams')}>
          Back to exams
        </button>
      </header>
      <section className="report sheet sheet--ruled">
        <div className="report__top">
          <div>
            <h1 className="display">{examTitle(exam.id)}</h1>
            <p className="report__sub">
              {result.correct} of {result.total} right · {Math.round(result.secondsUsed / 60)} minutes · {result.pace === 'test-day' ? 'test-day pace' : result.pace === 'relaxed' ? 'extra time' : 'untimed'}
            </p>
          </div>
          <div className="report__score">
            <span className="stamp stamp--big is-landing num">{result.scaled}</span>
            <span className="report__estimate">estimated Reading &amp; Writing</span>
          </div>
        </div>
        <p className="report__target">
          {result.scaled >= target ? (
            <>
              <span className="hl hl--green">On target.</span> {result.scaled} meets the ~{target} this half needs for {game.targetScore}.
            </>
          ) : (
            <>
              <span className="hl">{target - result.scaled} points to go</span> to the ~{target} this half needs for {game.targetScore}.
            </>
          )}
        </p>
        <ul className="report__domains">
          {result.byDomain.map((domain) => (
            <li key={domain.name}>
              <span className="report__dname">{domain.name}</span>
              <span className="meter meter--thick" style={{ ['--value' as string]: domain.total ? domain.correct / domain.total : 0, ['--mark' as string]: inkFor(domain.name) }}>
                <span />
              </span>
              <span className="num report__dscore">
                {domain.correct}/{domain.total}
              </span>
            </li>
          ))}
        </ul>
        <p className="report__clipped">
          <span className="stamp stamp--sm stamp--miss">Clipped</span> {missed.length} miss{missed.length === 1 ? '' : 'es'} went into your Mistake Notebook. They come back
          tomorrow, choices shuffled.
          {blanks > 0 && ` ${blanks} left blank — that’s pacing, so they count against the score but aren’t clipped.`} +100 XP, +8 drops and two sticker packs for sitting the
          whole test.
        </p>
      </section>

      <section className="report__misses" aria-labelledby="misses-title">
        <h2 className="title" id="misses-title">
          What you missed
        </h2>
        <ol className="misslist">
          {missed.map((question) => {
            const index = exam.modules.findIndex((module) => module.questions.includes(question))
            const open = openId === question.id
            return (
              <li key={question.id} className={`missrow ${open ? 'is-open' : ''}`}>
                <button type="button" className="missrow__head" onClick={() => setOpenId(open ? null : question.id)} aria-expanded={open}>
                  <span className="tag" style={{ ['--mark' as string]: inkFor(question.topic ?? '') }}>
                    {question.subtopic}
                  </span>
                  <span className="missrow__where">
                    Module {index + 1}, question {question.number}
                  </span>
                  <span className="missrow__answers">
                    you: <b>{answers[question.id] ?? '—'}</b> · answer: <b>{question.answer}</b>
                  </span>
                </button>
                {open && (
                  <div className="missrow__body">
                    <p className="missrow__stem">
                      <Rich text={question.stem} />
                    </p>
                    <p>{question.explanation?.summary ?? 'No written explanation for this one.'}</p>
                  </div>
                )}
              </li>
            )
          })}
          {missed.length === 0 && <li className="empty">A clean sheet. Nothing to clip.</li>}
        </ol>
        <div className="report__actions">
          <button type="button" className="btn btn--lg" onClick={() => go('/notebook')}>
            Open Mistake Notebook <ArrowRight />
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => go('/me')}>
            Open my sticker packs
          </button>
        </div>
        <p className="exams__fine">Scores are estimates on the live app’s curve, not official College Board scores.</p>
      </section>
    </div>
  )
}
