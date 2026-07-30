type ContentErrorProps = {
  skill: string | null
  level: string
  available: number
  onRetry: () => void
  onDashboard: () => void
}

export function ContentError({
  skill,
  level,
  available,
  onRetry,
  onDashboard,
}: ContentErrorProps) {
  return (
    <main className="adaptive-shell">
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
      <section className="adaptive-state-card adaptive-state-card--problem">
        <p className="eyebrow">Practice set unavailable</p>
        <h1>We need three distinct questions.</h1>
        <p role="alert">
          {skill ? `${skill} at ${level}` : `This ${level} checkpoint`} currently has {available} usable
          {available === 1 ? ' question' : ' questions'}. Your progress is safe.
        </p>
        <div className="adaptive-state-actions">
          <button className="button" type="button" onClick={onRetry}>Try again</button>
          <button className="button button--quiet" type="button" onClick={onDashboard}>Choose another domain</button>
        </div>
      </section>
    </main>
  )
}
