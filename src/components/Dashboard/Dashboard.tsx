import { useMemo } from 'react'

import { computeStats } from '../../review/stats.ts'
import { getAttempts, getReviews, now } from '../../storage/index.ts'
import type { Confidence, ErrorCause } from '../../types.ts'
import './dashboard.css'

const CAUSE_LABELS: Record<ErrorCause, string> = {
  'misread-passage': 'Misread passage',
  'misread-question': 'Misread question',
  trap: 'Trap answer',
  'knowledge-gap': 'Knowledge gap',
  rushed: 'Rushed',
}

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  sure: 'Sure',
  leaning: 'Leaning',
  guessing: 'Guessing',
}

// Each mistake type implies a different fix - spell it out so the numbers turn
// into a study plan, not just a scoreboard.
const CAUSE_PLAN: Record<ErrorCause, string> = {
  'misread-passage': 'Slow down on the text; annotate as you read.',
  'misread-question': 'Re-read the prompt before the choices.',
  trap: 'Study your trap profile below - you keep meeting the same ones.',
  'knowledge-gap': 'This is content to learn, not a careless slip.',
  rushed: 'A timing problem, not a knowledge one - pace differently.',
}

export function Dashboard({
  embedded = false,
  onBack,
}: {
  embedded?: boolean
  onBack: () => void
}) {
  const stats = useMemo(() => computeStats(getAttempts(), getReviews(), now()), [])
  const maxCause = Math.max(1, ...stats.causeBreakdown.map((c) => c.count))
  const Root = embedded ? 'section' : 'main'

  return (
    <Root
      className={embedded ? 'dashboard dashboard--embedded' : 'dashboard app-shell'}
      aria-label={embedded ? 'Insights' : undefined}
    >
      {!embedded && <header className="app-header">
        <button className="wordmark wordmark--button" type="button" onClick={onBack} aria-label="Back to Browse">
          clarity<span>.</span>
        </button>
        <button className="link-button" type="button" onClick={onBack}>Practice</button>
      </header>}

      <section className="hero-stat">
        <span className="hero-number">{stats.errorsDiagnosed}</span>
        <span className="hero-label">
          {stats.errorsDiagnosed === 1 ? 'error' : 'errors'} diagnosed
          {stats.totalAttempts > 0
            ? ` across ${stats.totalAttempts} ${stats.totalAttempts === 1 ? 'question' : 'questions'}`
            : ''}
        </span>
      </section>

      {stats.totalAttempts === 0 ? (
        /* Empty state is the shape of the full state, not a lone sentence in a
           void. Each panel names the report it will become, so the room reads
           as "not filled in yet" rather than "broken". No placeholder numbers:
           inventing a 47% here would be inventing data. */
        <div className="dash-empty">
          <p className="empty">
            Diagnose your first error and it’ll show up here. Every trap you find now is one that
            can’t catch you on test day.
          </p>
          <button className="button" type="button" onClick={onBack}>
            Start a practice set
          </button>
          <div className="dash-grid dash-grid--ghost" aria-hidden="true">
            {[
              { title: 'Where your errors come from', sub: 'Each type points to a different fix.', rows: 4 },
              { title: 'Calibration', sub: 'How often each confidence level is actually right.', rows: 3 },
              { title: 'Error-log health', sub: 'What is due, open, and cleared for good.', rows: 2 },
            ].map((panel) => (
              <section className="card card--ghost" key={panel.title}>
                <h2>{panel.title}</h2>
                <p className="card-sub">{panel.sub}</p>
                <ul className="ghost-bars">
                  {Array.from({ length: panel.rows }, (_, row) => (
                    <li key={row}><i /></li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <div className="dash-grid">
          <section className="card">
            <h2>Where your errors come from</h2>
            <p className="card-sub">Each type points to a different fix.</p>
            {stats.causeBreakdown.length === 0 ? (
              <p className="muted">No diagnosed causes yet.</p>
            ) : (
              <ul className="bars">
                {stats.causeBreakdown.map(({ cause, count }) => (
                  <li key={cause}>
                    <div className="bar-row">
                      <span>{CAUSE_LABELS[cause]}</span>
                      <span className="bar-count">{count}</span>
                    </div>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / maxCause) * 100}%` }} /></div>
                    <p className="bar-plan">{CAUSE_PLAN[cause]}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>Calibration</h2>
            <p className="card-sub">How often each confidence level is actually right.</p>
            <ul className="calib">
              {stats.calibration.map((row) => {
                const pct = row.total ? Math.round((row.correct / row.total) * 100) : null
                const alarm = row.confidence === 'sure' && pct !== null && pct < 100
                return (
                  <li key={row.confidence}>
                    <div className="bar-row">
                      <span>{CONFIDENCE_LABELS[row.confidence]}</span>
                      <span className="bar-count">{pct === null ? '-' : `${pct}% right`} <span className="muted">({row.total})</span></span>
                    </div>
                    <div className="bar-track">
                      <div className={`bar-fill ${alarm ? 'bar-fill--alarm' : ''}`} style={{ width: `${pct ?? 0}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="card-note">“Sure” but wrong is the most fixable error there is - high confidence means the correction sticks.</p>
          </section>

          <section className="card">
            <h2>Error-log health</h2>
            <div className="health">
              <div className="health-cell">
                <span className="health-num">{stats.queue.dueToday}</span>
                <span className="health-label">due to resurface</span>
              </div>
              <div className="health-cell">
                <span className="health-num">{stats.queue.outstanding}</span>
                <span className="health-label">still open</span>
              </div>
              <div className="health-cell">
                <span className="health-num">{stats.queue.retired}</span>
                <span className="health-label">cleared for good</span>
              </div>
              <div className="health-cell">
                <span className="health-num">{stats.timedOut}</span>
                <span className="health-label">ran out of time</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </Root>
  )
}
