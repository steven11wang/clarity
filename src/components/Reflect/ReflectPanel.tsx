import { ArrowRight, Archive } from 'lucide-react'

import { DailyReturnPanel } from '../DailyReview/DailyReview.tsx'
import { Dashboard } from '../Dashboard/Dashboard.tsx'
import type { DailyPlan } from '../../review/daily.ts'
import './reflect.css'

// Reflect is one page read top to bottom, and the order is the argument: what
// came back today (the work), then everything still on file (the vault), then
// what the record says about all of it (the pattern). The vault used to hang off
// Practice, where it sat next to the paths and read like another place to drill.
// It belongs here - a miss you are about to redo makes sense beside the account
// of why you missed it.
export function ReflectPanel({
  plan,
  at,
  streak,
  finishedToday,
  filedCount,
  dueCount,
  onStart,
  onOpenVault,
  onOpenPractice,
}: {
  plan: DailyPlan
  at: number
  streak: number
  finishedToday: boolean
  filedCount: number
  dueCount: number
  onStart: () => void
  onOpenVault: () => void
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
        />
      </div>

      <div className="reflect__band reflect__band--vault">
        <header className="reflect__band-head">
          <p className="reflect__eyebrow">THE VAULT</p>
          <h2>Every miss still on file</h2>
          <p className="reflect__band-lede">
            Wrong answers are filed the day they catch you and handed back on a widening schedule -
            1 day, 3 days, a week, a month. Clear all four and the question retires.
          </p>
        </header>
        <div className="reflect__vault-actions">
          <button className="console-button console-button--primary" type="button" onClick={onOpenVault}>
            <Archive size={16} strokeWidth={1.6} absoluteStrokeWidth aria-hidden="true" />
            Open the mistake vault
            <ArrowRight size={16} strokeWidth={1.75} absoluteStrokeWidth aria-hidden="true" />
          </button>
          <p className="reflect__vault-count">
            {filedCount === 0
              ? 'Nothing filed yet.'
              : `${filedCount} on file${dueCount > 0 ? ` · ${dueCount} due now` : ''}`}
          </p>
        </div>
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
