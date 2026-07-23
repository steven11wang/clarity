import { useEffect, useMemo, useState } from 'react'

import { Passage } from './components/Passage/Passage.tsx'
import { Browse } from './components/Browse/Browse.tsx'
import { QuestionInteraction } from './components/QuestionInteraction/QuestionInteraction.tsx'
import { loadQuestions } from './data/questions.ts'
import { recordAttempt, storage } from './storage/index.ts'
import type { Attempt, Question } from './types.ts'
import './app.css'

type LoadState = 'loading' | 'ready' | 'error'

function createAttempt(question: Question, chosen: string): Attempt {
  return {
    questionId: question.id,
    timestamp: Date.now(),
    chosen,
    correct: chosen === question.answer,
    confidence: null,
    attemptsToCorrect: chosen === question.answer ? 1 : 0,
    errorCause: null,
    selfExplanations: null,
    evidenceUnderlined: [],
    evidenceScore: null,
    chainBreakLink: null,
    trapGuess: null,
    trapActual: null,
    hiddenError: false,
    resurrectionStage: 0,
  }
}

function App() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [sessionQuestions, setSessionQuestions] = useState<Question[] | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [isChecked, setIsChecked] = useState(false)
  const [answered, setAnswered] = useState(0)

  useEffect(() => {
    setAnswered(storage.list<Attempt>('attempts:').length)
  }, [])

  useEffect(() => {
    let active = true

    loadQuestions()
      .then((loadedQuestions) => {
        if (!active) return
        setQuestions(loadedQuestions)
        setLoadState('ready')
      })
      .catch(() => {
        if (active) setLoadState('error')
      })

    return () => { active = false }
  }, [])

  const activeQuestions = sessionQuestions ?? questions
  const question = activeQuestions[currentIndex]
  const progress = useMemo(
    () => activeQuestions.length ? Math.round(((currentIndex + 1) / activeQuestions.length) * 100) : 0,
    [currentIndex, activeQuestions.length],
  )

  function checkAnswer() {
    if (!question || !selectedChoice || isChecked) return
    recordAttempt(createAttempt(question, selectedChoice))
    setAnswered((count) => count + 1)
    setIsChecked(true)
  }

  function moveToQuestion(direction: 1 | -1) {
    if (!activeQuestions.length) return
    setCurrentIndex((index) => (index + direction + activeQuestions.length) % activeQuestions.length)
    setSelectedChoice(null)
    setIsChecked(false)
  }

  if (loadState === 'loading') {
    return <main className="app-status">Loading your practice set…</main>
  }

  if (loadState === 'error' || !question) {
    return (
      <main className="app-status">
        <p>Clarity couldn’t load the practice set.</p>
        <button type="button" onClick={() => window.location.reload()}>Try again</button>
      </main>
    )
  }

  if (!sessionQuestions) {
    return <Browse questions={questions} onStart={(selectedQuestions) => { setSessionQuestions(selectedQuestions); setCurrentIndex(0) }} />
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="Clarity home">clarity<span>.</span></a>
        <button className="browse-link" type="button" onClick={() => setSessionQuestions(null)}>Browse sets</button>
      </header>

      <section className="question-progress" aria-label="Question progress">
        <div className="progress-copy"><span>Question {currentIndex + 1} of {activeQuestions.length}</span><span>{progress}%</span></div>
        <div className="progress-track"><div className="progress-value" style={{ width: `${progress}%` }} /></div>
      </section>

      <article className="practice-card">
        <div className="question-meta">
          <span>{question.domain}</span>
          <span className="meta-dot" aria-hidden="true">•</span>
          <span>{question.skill}</span>
          <span className="difficulty">{question.difficulty}</span>
        </div>

        <Passage question={question} />

        <QuestionInteraction question={question} selectedChoice={selectedChoice} checked={isChecked} onSelect={setSelectedChoice} onCheck={checkAnswer} onNext={() => moveToQuestion(1)} onPrevious={() => moveToQuestion(-1)} />
      </article>
    </main>
  )
}

export default App
