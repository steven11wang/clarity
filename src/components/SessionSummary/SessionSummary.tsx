import { useMemo } from 'react'

import { formatDue, upcomingReviews } from '../../review/stats.ts'
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

  const diagnosed = attempts.filter((a) => !a.correct || a.hiddenError).length
  const autopsies = attempts.filter((a) => a.errorCause !== null).length
  const hidden = attempts.filter((a) => a.hiddenError).length
  const traps = new Set(attempts.map((a) => a.trapGuess).filter(Boolean)).size

  return (
    <main className="summary app-shell">
      <header className="app-header">
        <span className="wordmark">clarity<span>.</span></span>
        <button className="link-button" type="button" onClick={onDashboard}>Dashboard</button>
      </header>

      <section className="summary-hero">
        <p className="eyebrow">Session complete</p>
        <h1>You diagnosed <strong>{diagnosed}</strong> {diagnosed === 1 ? 'error' : 'errors'}.</h1>
        <p>
          {diagnosed === 0
            ? 'A clean run — nothing new to bring back.'
            : 'Every one is now scheduled to come back until it can’t catch you.'}
        </p>
      </section>

      <div className="summary-stats">
        <div className="summary-stat"><span>{attempts.length}</span><small>questions</small></div>
        <div className="summary-stat"><span>{autopsies}</span><small>autopsies completed</small></div>
        <div className="summary-stat"><span>{traps}</span><small>trap patterns named</small></div>
        <div className="summary-stat"><span>{hidden}</span><small>hidden errors caught</small></div>
      </div>

      <section className="card">
        <h2>Coming back to you</h2>
        {upcoming.length === 0 ? (
          <p className="muted">Nothing scheduled — a clean run. Start another set to keep the streak.</p>
        ) : (
          <ul className="return-list">
            {upcoming.map((item) => (
              <li key={item.questionId}>
                <span className="return-reason">{item.reason === 'hidden-error' ? 'Right for the wrong reason' : 'Missed'}</span>
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
