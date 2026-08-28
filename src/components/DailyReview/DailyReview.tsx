import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'

import type { DailyPlan } from '../../review/daily.ts'
import {
  WordDrill,
  isDrillFinished,
  recordDrillAnswer,
  startWordDrill,
  type Drill,
} from '../WordBank/WordDrill.tsx'
import './dailyReview.css'

// The daily return has three surfaces:
//   1. the briefing — a dismissible sheet, the only interrupting piece;
//   2. the word run — a full activity, so it gets the whole screen;
//   3. the closing card.
// The questions themselves run through the ordinary practice engine; nothing
// here re-implements a question.

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

function formatDay(at: number): string {
  return new Date(at)
    .toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase()
}

function countLabel(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`
}

function headline(plan: DailyPlan): string {
  const parts: string[] = []
  if (plan.questions.length > 0) parts.push(countLabel(plan.questions.length, 'question'))
  if (plan.words.length > 0) parts.push(countLabel(plan.words.length, 'word'))
  return `${parts.join(' and ')} came back.`
}

// How long until the first thing on the ladder comes back. Coarse on purpose:
// the exact minute a card unlocks is never the interesting part.
function returnsIn(nextDueAt: number, at: number): string {
  const delta = nextDueAt - at
  if (delta <= 0) return 'any moment now'
  const minutes = Math.round(delta / 60000)
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`
  const days = Math.round(hours / 24)
  return days === 1 ? 'tomorrow' : `in ${days} days`
}

// What is filed and still waiting, said plainly. Nothing is ever due the same
// day it was missed, so without this line a student who just missed three
// questions would be told nothing had been filed at all.
function waitingLine(plan: DailyPlan, at: number): string | null {
  const { questions, words, nextDueAt } = plan.upcoming
  if (questions + words === 0) return null
  const parts = [
    questions > 0 ? countLabel(questions, 'question') : null,
    words > 0 ? countLabel(words, 'word') : null,
  ].filter(Boolean)
  const when = nextDueAt === null ? '' : ` The first comes back ${returnsIn(nextDueAt, at)}.`
  return `${parts.join(' and ')} filed and waiting on the ladder.${when}`
}

function streakLine(streak: number, finished: boolean): string {
  if (finished) {
    return streak === 1
      ? 'Day one of a streak. Come back tomorrow to make it two.'
      : `${streak} days in a row.`
  }
  return streak === 0
    ? 'No streak running. Finish today’s return to start one.'
    : `${streak}-day streak. Finish today’s return to make it ${streak + 1}.`
}

// --- The briefing sheet -------------------------------------------------------

export function DailyBriefing({
  plan,
  at,
  streak,
  onStart,
  onDismiss,
}: {
  plan: DailyPlan
  at: number
  streak: number
  onStart: () => void
  onDismiss: () => void
}) {
  const sheet = useRef<HTMLDivElement>(null)

  // A modal owns the keyboard while it is open: Escape closes it, Tab cycles
  // inside it, and focus goes back where it came from on the way out.
  useEffect(() => {
    const node = sheet.current
    const opener = document.activeElement as HTMLElement | null
    node?.querySelector<HTMLElement>('[data-autofocus]')?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismiss()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const stops = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (stops.length === 0) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      opener?.focus?.()
    }
  }, [onDismiss])

  const startsWithQuestions = plan.questions.length > 0

  return (
    <div className="daily-scrim" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onDismiss()
    }}>
      <div
        className="daily-sheet"
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-title"
      >
        <p className="daily-sheet__date">{formatDay(at)} · DAILY RETURN</p>
        <h1 id="daily-title">{headline(plan)}</h1>
        <p className="daily-sheet__lede">
          Each was filed the day it caught you or the day you saved it. Clear one and it
          moves a rung up the ladder; miss it and it starts over at a day.
        </p>

        <DailyLedger plan={plan} />

        <div className="daily-sheet__actions">
          <button
            className="console-button console-button--primary"
            type="button"
            data-autofocus
            onClick={onStart}
          >
            {startsWithQuestions ? 'Start with the questions' : 'Start with the words'}
            <ArrowRight size={16} strokeWidth={1.75} absoluteStrokeWidth aria-hidden="true" />
          </button>
          <button className="console-button console-button--secondary" type="button" onClick={onDismiss}>
            Not now
          </button>
        </div>

        <p className="daily-sheet__streak">{streakLine(streak, false)}</p>
      </div>
    </div>
  )
}

// The signature of this screen: one tick per item, grouped by how long it was
// away. The student reads the shape of the day's debt, not just a total —
// filled ticks are questions, hollow ones are words.
const MAX_TICKS = 18

function DailyLedger({ plan }: { plan: DailyPlan }) {
  return (
    <ol className="daily-ledger">
      {plan.cohorts.map((cohort) => {
        const total = cohort.questions + cohort.words
        const shown = Math.min(total, MAX_TICKS)
        const ticks = Array.from({ length: shown }, (_, index) => index < cohort.questions)
        const summary = [
          cohort.questions > 0 ? countLabel(cohort.questions, 'question') : null,
          cohort.words > 0 ? countLabel(cohort.words, 'word') : null,
        ]
          .filter(Boolean)
          .join(' · ')

        return (
          <li className="daily-ledger__row" key={cohort.stage}>
            <span className="daily-ledger__when">{cohort.label}</span>
            <span className="daily-ledger__ticks" aria-hidden="true">
              {ticks.map((isQuestion, index) => (
                <i
                  key={index}
                  className={isQuestion ? 'daily-tick daily-tick--question' : 'daily-tick daily-tick--word'}
                />
              ))}
              {total > shown && <em className="daily-ledger__more">+{total - shown}</em>}
            </span>
            <span className="daily-ledger__count">{summary}</span>
          </li>
        )
      })}
    </ol>
  )
}

// --- The word run -------------------------------------------------------------

export function DailyWords({
  plan,
  onFinish,
  onLeave,
}: {
  plan: DailyPlan
  onFinish: (knew: number) => void
  onLeave: () => void
}) {
  const [drill, setDrill] = useState<Drill | null>(() => startWordDrill(plan.words))
  const reported = useRef(false)

  // An empty queue counts as finished immediately: the daily return still has
  // to close out and bank the streak.
  useEffect(() => {
    if (reported.current) return
    if (drill && !isDrillFinished(drill)) return
    reported.current = true
    onFinish(drill?.knew ?? 0)
  }, [drill, onFinish])

  if (!drill || isDrillFinished(drill)) return null

  return (
    <main className="daily-stage">
      <p className="daily-stage__step">Step 2 of 2 · Words</p>
      <WordDrill
        drill={drill}
        exitLabel="Leave today’s return"
        onReveal={() => setDrill((current) => (current ? { ...current, revealed: true } : current))}
        onAnswer={(knewIt) => setDrill((current) => (current ? recordDrillAnswer(current, knewIt) : current))}
        onExit={onLeave}
      />
    </main>
  )
}

// --- The closing card ---------------------------------------------------------

export function DailyDone({
  questionsCleared,
  wordsRecalled,
  wordsTotal,
  streak,
  onClose,
}: {
  questionsCleared: number
  wordsRecalled: number
  wordsTotal: number
  streak: number
  onClose: () => void
}) {
  return (
    <main className="daily-stage">
      <div className="daily-done">
        <p className="daily-sheet__date">DAILY RETURN COMPLETE</p>
        <h1>Today’s return is clear.</h1>
        <p className="daily-done__lede">
          {countLabel(questionsCleared, 'question')} redone
          {wordsTotal > 0 ? `, ${wordsRecalled} of ${wordsTotal} words recalled` : ''}. What you
          cleared moves up a rung. What caught you comes back tomorrow.
        </p>
        <p className="daily-done__streak">{streakLine(streak, true)}</p>
        <button className="console-button console-button--primary" type="button" onClick={onClose}>
          Back to today
        </button>
      </div>
    </main>
  )
}

// --- The return, inside Reflect ------------------------------------------------

// The same return the briefing sheet offers, but as a place you can walk into
// rather than a thing that interrupts you. The sheet stays for the once-a-day
// nudge; this is the top band of Reflect the rest of the time.
export function DailyReturnPanel({
  plan,
  at,
  streak,
  finishedToday,
  onStart,
  onOpenVault,
}: {
  plan: DailyPlan
  at: number
  streak: number
  finishedToday: boolean
  onStart: () => void
  onOpenVault?: () => void
}) {
  const startsWithQuestions = plan.questions.length > 0
  const nothingDue = plan.total === 0
  const waiting = waitingLine(plan, at)
  const filedCount = plan.upcoming.questions + plan.upcoming.words

  return (
    <section className="daily-panel" aria-label="Today’s return">
      <p className="daily-sheet__date">{formatDay(at)} · DAILY RETURN</p>
      <h1>
        {finishedToday
          ? 'Today’s return is clear.'
          : nothingDue
            ? filedCount > 0
              ? 'Nothing due yet. Everything is filed.'
              : 'Nothing has come back yet.'
            : headline(plan)}
      </h1>
      <p className="daily-panel__lede">
        {finishedToday
          ? 'What you cleared moves up a rung. What caught you comes back tomorrow.'
          : nothingDue
            ? 'Misses and saved words are filed the day they happen and handed back on a widening schedule — 1 day, 3 days, a week, a month. Nothing returns the same day it caught you.'
            : 'Each was filed the day it caught you or the day you saved it. Clear one and it moves a rung up the ladder; miss it and it starts over at a day.'}
      </p>

      {!finishedToday && !nothingDue && <DailyLedger plan={plan} />}

      {waiting && <p className="daily-panel__waiting">{waiting}</p>}

      {(!finishedToday && !nothingDue) || (filedCount > 0 && onOpenVault) ? (
        <div className="daily-panel__actions">
          {!finishedToday && !nothingDue && (
            <button className="console-button console-button--primary" type="button" onClick={onStart}>
              {startsWithQuestions ? 'Start with the questions' : 'Start with the words'}
              <ArrowRight size={16} strokeWidth={1.75} absoluteStrokeWidth aria-hidden="true" />
            </button>
          )}
          {filedCount > 0 && onOpenVault && (
            <button
              className="console-button console-button--secondary"
              type="button"
              onClick={onOpenVault}
            >
              See every miss on file
            </button>
          )}
        </div>
      ) : null}

      <p className="daily-panel__streak">{streakLine(streak, finishedToday)}</p>
    </section>
  )
}

// --- Re-entry -----------------------------------------------------------------

// Dismissing the briefing shouldn't hide the work. This sits quietly above the
// fold-out bar until the day's return is finished.
export function DailyReturnPill({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button className="daily-pill" type="button" onClick={onOpen}>
      <RotateCcw size={14} strokeWidth={1.75} absoluteStrokeWidth aria-hidden="true" />
      Today’s return
      <span className="daily-pill__count">{count}</span>
    </button>
  )
}
