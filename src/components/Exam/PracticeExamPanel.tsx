import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Clock3, FileText, ListChecks } from 'lucide-react'

import { useAuthProfile } from '../../auth/AuthContext.tsx'
import { ExamReport } from './ExamReport.tsx'
import { ExamRunner, type ExamResult } from './ExamRunner.tsx'
import {
  examQuestionCount,
  loadPracticeExam,
  type PracticeExam,
} from './examData.ts'
import { useExamTheme } from './useExamTheme.ts'
import './exam.css'

type Phase = 'intro' | 'running' | 'report'

export function PracticeExamPanel({ onBack }: { onBack?: () => void } = {}) {
  const { displayName } = useAuthProfile()
  const [theme, setTheme] = useExamTheme()
  const [exam, setExam] = useState<PracticeExam | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [phase, setPhase] = useState<Phase>('intro')
  const [result, setResult] = useState<ExamResult | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    loadPracticeExam()
      .then((loaded) => {
        if (!live) return
        setExam(loaded)
        setStatus('ready')
      })
      .catch(() => {
        if (live) setStatus('error')
      })
    return () => {
      live = false
    }
  }, [])

  // The runner owns the whole screen, exactly like the real testing app: no
  // console chrome, no scroll behind it.
  useEffect(() => {
    if (phase === 'intro') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [phase])

  if (status === 'loading') {
    return <section className="exam-intro exam-intro--status">Loading the practice exam…</section>
  }
  if (status === 'error' || !exam) {
    return (
      <section className="exam-intro exam-intro--status">
        <p>Clarity couldn’t load the practice exam.</p>
        <button className="exam-button exam-button--primary" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </section>
    )
  }

  // Portalled to <body>: nested in the console panel the fixed overlay still
  // sat under the app header, so the nav bled through and swallowed clicks.
  if (phase === 'running') {
    return createPortal(
      <div className="exam-overlay" data-exam-theme={theme}>
        <ExamRunner
          key={attempt}
          exam={exam}
          learnerName={displayName}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onExit={() => setPhase('intro')}
          onFinish={(finished) => {
            setResult(finished)
            setPhase('report')
          }}
        />
      </div>,
      document.body,
    )
  }

  if (phase === 'report' && result) {
    return createPortal(
      <div className="exam-overlay" data-exam-theme={theme}>
        <ExamReport
          exam={exam}
          result={result}
          onRetake={() => {
            setAttempt((count) => count + 1)
            setResult(null)
            setPhase('running')
          }}
          onExit={() => {
            setResult(null)
            setPhase('intro')
          }}
        />
      </div>,
      document.body,
    )
  }

  const minutes = exam.modules.reduce(
    (sum, module) => sum + module.durationSeconds / 60,
    0,
  )

  return (
    <section className="exam-intro">
      <header className="exam-intro__head">
        {onBack ? (
          <button className="exam-intro__back" type="button" onClick={onBack}>
            <ArrowLeft size={16} strokeWidth={1.7} /> Back to practice
          </button>
        ) : null}
        <p>PRACTICE EXAM · FULL LENGTH</p>
        <h1>Sit the whole section the way test day runs it.</h1>
        <span>
          Two timed modules, one question at a time, the same tools you get in the
          real app: mark for review, cross out answers, highlight the passage.
          Nothing is scored until you submit.
        </span>
      </header>

      <article className="exam-card">
        <div className="exam-card__title">
          <h2>{exam.title}</h2>
          <p>{exam.subject}</p>
        </div>
        <ul className="exam-card__facts">
          <li>
            <span aria-hidden="true"><FileText size={17} strokeWidth={1.6} /></span>
            {exam.modules.length} modules
          </li>
          <li>
            <span aria-hidden="true"><ListChecks size={17} strokeWidth={1.6} /></span>
            {examQuestionCount(exam)} questions
          </li>
          <li>
            <span aria-hidden="true"><Clock3 size={17} strokeWidth={1.6} /></span>
            {Math.round(minutes)} minutes
          </li>
        </ul>
        <p className="exam-card__note">
          {exam.answerKeySource === 'derived'
            ? 'Scored against Clarity’s own answer key, not an official College Board key.'
            : 'Scored against the published answer key.'}
        </p>
        <button
          className="exam-button exam-button--primary"
          type="button"
          onClick={() => {
            setAttempt((count) => count + 1)
            setPhase('running')
          }}
        >
          Start the exam
        </button>
      </article>
    </section>
  )
}
