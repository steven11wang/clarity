import { useId, useMemo, useRef, useState, type FormEvent } from 'react'

import { orderedChoices, type ChoiceLetter } from '../../review/ordering.ts'
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
  onSubmit: (answers: BatchAnswers) => void
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
  const [showLesson, setShowLesson] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const answered = questions.filter((question) => answers[question.id]).length
  const complete = answered === questions.length
  const currentQuestion = questions[currentIndex]

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
      onSubmit(answers)
    } catch (error) {
      submitLock.current = false
      setSubmitting(false)
      throw error
    }
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
            <span>{answered} answered</span>
          </div>
          <div className="progress-track">
            {questions.map((question, index) => (
              <span
                className={[
                  'progress-segment',
                  answers[question.id] ? 'progress-segment--done' : '',
                  index === currentIndex ? 'progress-segment--current' : '',
                ].filter(Boolean).join(' ')}
                key={question.id}
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
            const lesson = lessonFor(question)
            return showLesson ? (
              <section className="quiz-lesson" aria-labelledby={`${promptId}-lesson`}>
                <div className="quiz-lesson__badge" aria-hidden="true">✦</div>
                <div>
                  <p className="eyebrow">60-second lesson · {question.skill}</p>
                  <h2 id={`${promptId}-lesson`}>{lesson.title}</h2>
                  <p>{lesson.explanation}</p>
                  <div className="quiz-lesson__example">
                    <strong>Worked example</strong>
                    <span>{lesson.example}</span>
                  </div>
                  <p className="quiz-lesson__tip"><strong>Try this:</strong> {lesson.tip}</p>
                  <button className="button" type="button" onClick={() => setShowLesson(false)}>
                    Try question {index + 1} →
                  </button>
                </div>
              </section>
            ) : (
              <fieldset className="batch-question" key={question.id}>
                <legend>
                  <span>Question {index + 1}</span>
                  <span>{question.skill}</span>
                </legend>
                <div className="batch-question__body">
                  <Passage question={question} />
                  <section className="batch-question__answer" aria-labelledby={promptId}>
                    <p className="batch-question__level">{question.difficulty}</p>
                    <h2 id={promptId}>{question.prompt}</h2>
                    <div className="batch-choice-list">
                      {choices[question.id].map((choice) => {
                        const inputId = `${formId}-question-${index}-${choice.displayLetter}`
                        const selected = answers[question.id] === choice.sourceLetter
                        return (
                          <label className={`batch-choice ${selected ? 'batch-choice--selected' : ''}`} htmlFor={inputId} key={choice.displayLetter}>
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
                            <span className="choice-letter" aria-hidden="true">{choice.displayLetter}</span>
                            <span>{choice.text}</span>
                          </label>
                        )
                      })}
                    </div>
                  </section>
                </div>
                <footer className="question-step-actions">
                  <span>{answers[question.id] ? 'Answer saved' : 'Choose one answer to continue'}</span>
                  {index + 1 < questions.length ? (
                    <button
                      className="button"
                      type="button"
                      disabled={!answers[question.id]}
                      onClick={() => {
                        setCurrentIndex((value) => value + 1)
                        setShowLesson(true)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      Next question →
                    </button>
                  ) : (
                    <button className="button" type="submit" disabled={!complete || submitting}>
                      {submitting ? 'Saving…' : submitLabel}
                    </button>
                  )}
                </footer>
              </fieldset>
            )
          })()}
        </div>
      </form>
    </main>
  )
}

function lessonFor(question: Question) {
  const name = question.skill.toLowerCase()
  if (name.includes('boundar') || name.includes('punctuation')) {
    return {
      title: 'Find the sentence boundary before choosing punctuation.',
      explanation: 'A complete sentence needs a subject and a complete verb. If both sides of the blank can stand alone, use punctuation that can join two independent clauses.',
      example: '“The rain stopped. We left.” Both halves are complete, so a period or semicolon can separate them; a comma alone cannot.',
      tip: 'Read only the words immediately before and after the blank. Label each side complete or incomplete.',
    }
  }
  if (name.includes('structure') || name.includes('purpose')) {
    return {
      title: 'Describe what the author is doing—not just what they say.',
      explanation: 'Purpose answers why a detail exists. Strong answers use an action verb such as introduce, contrast, illustrate, qualify, or support.',
      example: 'If sentence 1 presents a theory and sentence 2 gives a case where it fails, sentence 2 “qualifies the theory with a counterexample.”',
      tip: 'Give each paragraph a two- or three-word job label before reading the choices.',
    }
  }
  if (name.includes('transition')) {
    return {
      title: 'Name the relationship, then choose the transition.',
      explanation: 'Transitions signal logic. Decide whether the next sentence continues, contrasts, gives a result, or offers an example before looking at the options.',
      example: '“The route was longer. However, it was safer.” “However” works because the second idea contrasts with the first.',
      tip: 'Cover the choices and say the relationship in your own words first.',
    }
  }
  if (name.includes('inference') || name.includes('evidence')) {
    return {
      title: 'Choose the claim the passage proves—not one it merely allows.',
      explanation: 'The correct inference must be supported by specific words in the passage and must not add a new assumption.',
      example: '“Three of four plants grew faster in shade” supports “shade often helped,” not “all plants always need shade.”',
      tip: 'Point to the exact phrase that would defend your answer to a skeptical reader.',
    }
  }
  return {
    title: 'Turn the question into a small, testable job.',
    explanation: 'First identify what the prompt asks you to prove. Then predict the shape of a correct answer before comparing choices.',
    example: 'If the prompt asks for the main purpose, your prediction should begin with an action verb: “The author introduces…”',
    tip: 'Reject any choice that is true about the passage but does not perform the exact job in the prompt.',
  }
}
