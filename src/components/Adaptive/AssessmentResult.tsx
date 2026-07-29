import { useEffect, useRef } from 'react'

type AssessmentResultProps = {
  eyebrow: string
  title: string
  score: number
  total: number
  message: string
  details?: string[]
  success: boolean
  nextLabel: string
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
        <span className="wordmark">clarity<span>.</span></span>
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

      <div className="assessment-result__actions">
        <button className="button" type="button" onClick={onNext}>{nextLabel}</button>
        <button className="button button--quiet" type="button" onClick={onDashboard}>Back to all domains</button>
      </div>
    </main>
  )
}
