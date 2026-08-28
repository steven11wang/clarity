import { DailyReturnPanel } from '../DailyReview/DailyReview.tsx'
import { Dashboard } from '../Dashboard/Dashboard.tsx'
import type { DailyPlan } from '../../review/daily.ts'
import './reflect.css'

// Reflect is one page with two bands, read top to bottom: what came back today
// (the work), then what the record says about it (the pattern). Insights used
// to be its own tab, but a scoreboard with no adjacent action is a place you
// visit once - here the numbers sit under the queue that answers them.
export function ReflectPanel({
  plan,
  at,
  streak,
  finishedToday,
  onStart,
  onOpenVault,
  onOpenPractice,
}: {
  plan: DailyPlan
  at: number
  streak: number
  finishedToday: boolean
  onStart: () => void
  onOpenVault?: () => void
  onOpenPractice: () => void
}) {
  return (
    <section className="reflect" aria-label="Reflect">
      <div className="reflect__band">
        <DailyReturnPanel
          plan={plan}
          at={at}
          streak={streak}
          finishedToday={finishedToday}
          onStart={onStart}
          onOpenVault={onOpenVault}
        />
      </div>

      <div className="reflect__band reflect__band--patterns">
        <header className="reflect__band-head">
          <p className="reflect__eyebrow">THE RECORD</p>
          <h2>What your errors keep saying</h2>
          <p className="reflect__band-lede">
            Every error you diagnose is filed here. The shape of the pile is the study plan -
            it tells you what to change, not just how you did.
          </p>
        </header>
        <Dashboard embedded onBack={onOpenPractice} />
      </div>
    </section>
  )
}
