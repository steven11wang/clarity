import { useEffect, useRef } from 'react'

export type ResultBreakdownItem = {
  id: string
  prompt: string
  skill: string
  chosen: string
  correctAnswer: string
  correct: boolean
}

type AssessmentResultProps = {
  eyebrow: string
  title: string
  score: number
  total: number
  message: string
  details?: string[]
  success: boolean
  nextLabel: string
  breakdown?: ResultBreakdownItem[]
  onNext: () => void
  onDashboard: () => void
}

export function AssessmentResult({
  eyebrow,
  title,
  score,
  total,
  message,
  details = [],
  success,
  nextLabel,
  breakdown = [],
  onNext,
  onDashboard,
}: AssessmentResultProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  return (
    <main className="adaptive-shell result-shell">
      <header className="adaptive-header">
        <button
          className="wordmark wordmark--button"
          type="button"
          onClick={onDashboard}
          aria-label="Open dashboard"
        >
          clarity<span>.</span>
        </button>
        <button className="link-button" type="button" onClick={onDashboard}>Dashboard</button>
      </header>

      <section className={`assessment-result ${success ? 'assessment-result--success' : ''}`} aria-live="polite">
        <div className="assessment-result__score" aria-label={`${score} out of ${total} correct`}>
          <strong>{score}</strong>
          <span>/ {total}</span>
        </div>
        <div className="assessment-result__copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1 ref={titleRef} tabIndex={-1}>{title}</h1>
          <p>{message}</p>
        </div>
      </section>

      {details.length > 0 && (
        <section className="assessment-result__details" aria-labelledby="result-details-title">
          <h2 id="result-details-title">What happens next</h2>
          <ul>
            {details.map((detail) => <li key={detail}>{detail}</li>)}
          </ul>
        </section>
      )}

      {breakdown.length > 0 && (
        <section className="assessment-result__breakdown" aria-labelledby="result-breakdown-title">
          <h2 id="result-breakdown-title">Question by question</h2>
          <ol>
            {breakdown.map((item, index) => (
              <li
                key={item.id}
                className={`result-breakdown__item ${
                  item.correct ? 'result-breakdown__item--correct' : 'result-breakdown__item--incorrect'
                }`}
              >
                <span className="result-breakdown__status" aria-hidden="true">
                  {item.correct ? '✓' : '✗'}
                </span>
                <span className="result-breakdown__body">
                  <span className="result-breakdown__meta">
                    Q{index + 1} · {item.skill}
                  </span>
                  <span className="result-breakdown__prompt">{item.prompt}</span>
                  <span className="result-breakdown__answer">
                    {item.correct
                      ? `Your answer: ${item.chosen}`
                      : `Your answer: ${item.chosen || '-'} · Correct: ${item.correctAnswer}`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="assessment-result__actions">
        <button className="button" type="button" onClick={onNext}>{nextLabel}</button>
        <button className="button button--quiet" type="button" onClick={onDashboard}>Back</button>
      </div>
    </main>
  )
}
