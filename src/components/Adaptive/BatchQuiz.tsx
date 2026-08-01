import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'

import { orderedChoices, type ChoiceLetter } from '../../review/ordering.ts'
import { toggleChoiceStrikeout } from '../QuestionInteraction/model.ts'
import { AbcToggle, ChoiceMarker } from '../QuestionInteraction/ChoiceStrikeout.tsx'
import type { Question } from '../../types.ts'
import { Passage } from '../Passage/Passage.tsx'

export type BatchAnswers = Record<string, ChoiceLetter>

type BatchQuizProps = {
  eyebrow: string
  title: string
  description: string
  questions: Question[]
  assessmentId: string
  submitLabel: string
  initialAnswers: BatchAnswers
  onAnswersChange: (answers: BatchAnswers) => void
  onCancel: () => void
  onSubmit: (answers: BatchAnswers, flagged: string[]) => void
}

export function BatchQuiz({
  eyebrow,
  title,
  description,
  questions,
  assessmentId,
  submitLabel,
  initialAnswers,
  onAnswersChange,
  onCancel,
  onSubmit,
}: BatchQuizProps) {
  const formId = useId()
  const [answers, setAnswers] = useState<BatchAnswers>(() => initialAnswers)
  const [currentIndex, setCurrentIndex] = useState(() => {
    const firstOpen = questions.findIndex((question) => !initialAnswers[question.id])
    return firstOpen < 0 ? Math.max(0, questions.length - 1) : firstOpen
  })
  const [submitting, setSubmitting] = useState(false)
  const [struckChoices, setStruckChoices] = useState<string[]>([])
  const [abcMode, setAbcMode] = useState(false)
  const [flagged, setFlagged] = useState<Record<string, boolean>>({})
  const submitLock = useRef(false)
  const answered = questions.filter((question) => answers[question.id]).length
  const complete = answered === questions.length
  const currentQuestion = questions[currentIndex]
  const canGoBack = currentIndex > 0
  const flaggedCount = Object.values(flagged).filter(Boolean).length

  function toggleFlag(questionId: string) {
    setFlagged((current) => ({ ...current, [questionId]: !current[questionId] }))
  }

  useEffect(() => {
    setStruckChoices([])
    setAbcMode(false)
  }, [currentQuestion?.id])

  const choices = useMemo(
    () =>
      Object.fromEntries(
        questions.map((question) => [
          question.id,
          orderedChoices(question, true, `${assessmentId}:${question.id}`),
        ]),
      ),
    [assessmentId, questions],
  )

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!complete || submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    try {
      onSubmit(
        answers,
        questions.filter((question) => flagged[question.id]).map((question) => question.id),
      )
    } catch (error) {
      submitLock.current = false
      setSubmitting(false)
      throw error
    }
  }

  function jumpToQuestion(index: number) {
    setCurrentIndex(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="adaptive-shell batch-shell">
      <header className="adaptive-header">
        <button className="wordmark wordmark--button" type="button" onClick={onCancel} aria-label="Leave this assessment">
          clarity<span>.</span>
        </button>
        <button className="link-button" type="button" onClick={onCancel}>Leave assessment</button>
      </header>

      <section className="batch-intro batch-intro--compact">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <div
          className="batch-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={answered}
          aria-label={`${answered} of ${questions.length} questions answered`}
        >
          <div className="batch-progress__copy">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>{answered} answered{flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ''}</span>
          </div>
          <div className="progress-track" role="tablist" aria-label="Questions">
            {questions.map((question, index) => (
              <button
                className={[
                  'progress-segment',
                  answers[question.id] ? 'progress-segment--done' : '',
                  index === currentIndex ? 'progress-segment--current' : '',
                  flagged[question.id] ? 'progress-segment--flagged' : '',
                ].filter(Boolean).join(' ')}
                key={question.id}
                type="button"
                role="tab"
                aria-selected={index === currentIndex}
                aria-label={`Go to question ${index + 1}${answers[question.id] ? ', answered' : ''}${flagged[question.id] ? ', flagged for review' : ''}`}
                onClick={() => jumpToQuestion(index)}
              />
            ))}
          </div>
        </div>
      </section>

      <form onSubmit={submit}>
        <div className="batch-questions">
          {currentQuestion && (() => {
            const question = currentQuestion
            const index = currentIndex
            const promptId = `${formId}-prompt-${index}`
            return (
              <fieldset className="batch-question" key={question.id}>
                <legend>
                  <span>Question {index + 1}</span>
                  <span className="batch-question__legend-right">
                    <button
                      type="button"
                      className={`flag-toggle ${flagged[question.id] ? 'flag-toggle--active' : ''}`}
                      aria-pressed={!!flagged[question.id]}
                      onClick={() => toggleFlag(question.id)}
                    >
                      {flagged[question.id] ? '🚩 Flagged' : '⚑ Flag for review'}
                    </button>
                    {question.skill}
                  </span>
                </legend>
                <div className="batch-question__body">
                  <Passage question={question} />
                  <section className="batch-question__answer" aria-labelledby={promptId}>
                    <p className="batch-question__level">{question.difficulty}</p>
                    <div className="question-heading">
                      <h2 id={promptId}>{question.prompt}</h2>
                      <AbcToggle active={abcMode} onToggle={() => setAbcMode((active) => !active)} />
                    </div>
                    <div className="batch-choice-list">
                      {choices[question.id].map((choice) => {
                        const inputId = `${formId}-question-${index}-${choice.displayLetter}`
                        const selected = answers[question.id] === choice.sourceLetter
                        const struck = struckChoices.includes(choice.sourceLetter)
                        return (
                          <div className={`batch-choice ${selected ? 'batch-choice--selected' : ''} ${struck ? 'batch-choice--struck' : ''}`} key={choice.displayLetter}>
                            <label className="batch-choice__select" htmlFor={inputId}>
                              <input
                                id={inputId}
                                type="radio"
                                name={`question-${question.id}`}
                                value={choice.sourceLetter}
                                checked={selected}
                                onChange={() => {
                                  const next = {
                                    ...answers,
                                    [question.id]: choice.sourceLetter,
                                  }
                                  setAnswers(next)
                                  onAnswersChange(next)
                                }}
                              />
                              <span className="batch-choice__text">{choice.text}</span>
                            </label>
                            {abcMode && (
                              <ChoiceMarker
                                letter={choice.displayLetter}
                                struck={struck}
                                onToggle={() => setStruckChoices((current) => toggleChoiceStrikeout(current, choice.sourceLetter))}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </div>
                <footer className="question-step-actions">
                  <span>{answers[question.id] ? 'Answer saved' : 'Choose one answer to continue'}</span>
                  <div className="question-step-actions__buttons">
                    <button
                      className="button button--quiet"
                      type="button"
                      disabled={!canGoBack}
                      onClick={() => jumpToQuestion(index - 1)}
                    >
                      ← Back
                    </button>
                    {index + 1 < questions.length ? (
                      <button
                        className="button"
                        type="button"
                        disabled={!answers[question.id]}
                        onClick={() => jumpToQuestion(index + 1)}
                      >
                        Next →
                      </button>
                    ) : (
                      <button className="button" type="submit" disabled={!complete || submitting}>
                        {submitting ? 'Saving…' : submitLabel}
                      </button>
                    )}
                  </div>
                </footer>
              </fieldset>
            )
          })()}
        </div>
      </form>
    </main>
  )
}
