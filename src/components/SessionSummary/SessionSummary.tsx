import { useMemo } from 'react'

import { REVIEW_REASON_LABELS, formatDue, upcomingReviews } from '../../review/stats.ts'
import { getReviews, now } from '../../storage/index.ts'
import type { Attempt } from '../../types.ts'
import './summary.css'

type Props = {
  attempts: Attempt[]
  onPracticeMore: () => void
  onDashboard: () => void
}

export function SessionSummary({ attempts, onPracticeMore, onDashboard }: Props) {
  const nowTs = now()
  const upcoming = useMemo(() => upcomingReviews(getReviews(), 6), [])

  const total = attempts.length
  const correct = attempts.filter((a) => a.correct).length
  const incorrect = total - correct
  const scorePct = total ? Math.round((correct / total) * 100) : 0
  const diagnosed = attempts.filter((a) => !a.correct).length
  const timedOut = attempts.filter((a) => a.timedOut).length

  return (
    <main className="summary app-shell">
      <header className="app-header">
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

      <section className="summary-hero">
        <p className="eyebrow">Session complete</p>
        <h1>You scored <strong>{scorePct}%</strong> - {correct} of {total} correct.</h1>
        <p>
          {diagnosed === 0
            ? 'A clean run - nothing new to bring back.'
            : `You diagnosed ${diagnosed} ${diagnosed === 1 ? 'error' : 'errors'}. Each is scheduled to come back until it can’t catch you.`}
        </p>
        <div className="score-bar" role="img" aria-label={`${correct} correct, ${incorrect} incorrect`}>
          <div className="score-bar-fill" style={{ width: `${scorePct}%` }} />
        </div>
      </section>

      <div className="summary-stats">
        <div className="summary-stat"><span>{total}</span><small>total questions</small></div>
        <div className="summary-stat summary-stat--correct"><span>{correct}</span><small>correct</small></div>
        <div className="summary-stat summary-stat--incorrect"><span>{incorrect}</span><small>incorrect</small></div>
        <div className="summary-stat"><span>{timedOut > 0 ? timedOut : diagnosed}</span><small>{timedOut > 0 ? 'ran out of time' : 'errors diagnosed'}</small></div>
      </div>

      <section className="card">
        <h2>Coming back to you</h2>
        {upcoming.length === 0 ? (
          <p className="muted">Nothing scheduled - a clean run. Start another set to keep the streak.</p>
        ) : (
          <ul className="return-list">
            {upcoming.map((item) => (
              <li key={item.questionId}>
                <span className="return-reason">{REVIEW_REASON_LABELS[item.reason]}</span>
                <span className="return-when">{formatDue(item.dueAt, nowTs)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="summary-actions">
        <button className="button" type="button" onClick={onPracticeMore}>Practice more</button>
        <button className="button button--quiet" type="button" onClick={onDashboard}>See dashboard</button>
      </div>
    </main>
  )
}
