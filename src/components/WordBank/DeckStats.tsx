import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

import type { WordDeckContent } from '../../dictionary/wordDecks.ts'
import { deckCards, type DeckReview } from '../../review/deckQueue.ts'
import { DECK_CONFIG, RATINGS, RATING_LABELS, type Rating } from '../../review/deckScheduler.ts'
import {
  CARD_BUCKET_LABELS,
  answerButtons,
  calendarDays,
  cardCounts,
  dailyLoad,
  easeHistogram,
  formatDuration,
  formatPercent,
  futureDue,
  hourlyBreakdown,
  intervalHistogram,
  reviewsByDay,
  studyStreak,
  todayStats,
  trueRetention,
  type CardBucket,
  type DayBar,
} from '../../review/deckStats.ts'
import { getDeckCards, getDeckReviews, now } from '../../storage/index.ts'

// The analysis screen, modelled on Anki's statistics page.
//
// Anki's own page is the reference because it is the one every serious user of
// spaced repetition already reads: Today, Future Due, the calendar heatmap,
// Reviews, Card Counts, Ease, Intervals, Answer Buttons, Hourly Breakdown and
// True Retention, in that order. The arithmetic is in review/deckStats.ts; this
// file is only the drawing, done in plain SVG so it costs no library.

const BUCKET_COLORS: Record<CardBucket, string> = {
  new: '#5b8def',
  learning: '#e8a33d',
  relearning: '#e0654f',
  young: '#57b894',
  mature: '#2f7d5f',
}

const RATING_COLORS: Record<Rating, string> = {
  1: '#e0654f',
  2: '#e8a33d',
  3: '#57b894',
  4: '#5b8def',
}

type DeckStatsProps = {
  decks: WordDeckContent[]
  onBack: () => void
}

export function DeckStats({ decks, onBack }: DeckStatsProps) {
  const [scope, setScope] = useState<string>('all')

  const data = useMemo(() => {
    const at = now()
    const saved = getDeckCards()
    const chosen = scope === 'all' ? decks : decks.filter((deck) => deck.id === scope)
    const cards = chosen.flatMap((deck) =>
      deckCards(
        deck.cards.map((entry) => entry.id),
        deck.id,
        saved,
      ),
    )
    const ids = new Set(chosen.map((deck) => deck.id))
    const log: DeckReview[] = getDeckReviews().filter((entry) => ids.has(entry.deckId))
    return { at, cards, log }
  }, [decks, scope])

  const { at, cards, log } = data
  const today = todayStats(log, at)
  const counts = cardCounts(cards)
  const due = futureDue(cards, at, 30)
  const days = reviewsByDay(log, at, 30)
  const calendar = calendarDays(log, at, 182)
  const ease = easeHistogram(cards)
  const intervals = intervalHistogram(cards)
  const buttons = answerButtons(log)
  const hours = hourlyBreakdown(log)
  const retention = trueRetention(log, at)
  const seen = cards.filter((card) => card.phase !== 'new').length

  return (
    <section className="deckstats" aria-label="Deck analysis">
      <header className="deckstats__head">
        <button className="wordbank__back" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Back to the decks
        </button>
        <p className="wordbank__eyebrow">ANALYSIS</p>
        <h1>What the decks<br />know about you.</h1>
        <p className="wordbank__lede">
          The same read-out Anki gives: what today cost, what the coming weeks
          owe, and - in the retention table at the bottom - whether the schedule
          is actually holding.
        </p>

        <nav className="wordbank__filters" aria-label="Which deck to analyse">
          <button
            className={scope === 'all' ? 'is-active' : undefined}
            type="button"
            aria-pressed={scope === 'all'}
            onClick={() => setScope('all')}
          >
            Both decks
          </button>
          {decks.map((deck) => (
            <button
              key={deck.id}
              className={scope === deck.id ? 'is-active' : undefined}
              type="button"
              aria-pressed={scope === deck.id}
              onClick={() => setScope(deck.id)}
            >
              {deck.title}
            </button>
          ))}
        </nav>
      </header>

      {seen === 0 && log.length === 0 ? (
        <p className="wordbank__empty">
          Nothing to analyse yet. Study a deck and the graphs fill in from the
          first card you answer.
        </p>
      ) : (
        <div className="deckstats__grid">
          <Panel title="Today" note="Everything answered since the day rolled over at 4am.">
            <dl className="deckstats__figures">
              <div>
                <dt>{today.reviews}</dt>
                <dd>REVIEWS</dd>
              </div>
              <div>
                <dt>{formatDuration(today.timeMs)}</dt>
                <dd>TIME</dd>
              </div>
              <div>
                <dt>{formatPercent(today.correct)}</dt>
                <dd>NOT AGAIN</dd>
              </div>
              <div>
                <dt>{today.newIntroduced}</dt>
                <dd>NEW WORDS</dd>
              </div>
            </dl>
            <p className="deckstats__note">
              {today.reviews === 0
                ? 'Nothing studied today.'
                : `${today.learning} learning · ${today.review} review · ${today.relearning} relearning. ` +
                  `${today.again} went back to Again.`}
            </p>
          </Panel>

          <Panel
            title="Future due"
            note={`What the next thirty days owe if nothing is failed. Daily load: about ${
              Math.round(dailyLoad(cards) * 10) / 10
            } cards a day.`}
          >
            <BarChart
              bars={due.map((bar) => ({
                label: bar.offset === 0 ? 'Today' : `In ${bar.offset}d`,
                value: bar.count,
                color: '#5b8def',
              }))}
              labelEvery={5}
            />
          </Panel>

          <Panel title="Card counts" note={`${cards.length} cards in view.`}>
            <div className="deckstats__counts">
              <Donut counts={counts} total={cards.length} />
              <ul className="deckstats__legend">
                {(Object.keys(CARD_BUCKET_LABELS) as CardBucket[]).map((bucket) => (
                  <li key={bucket}>
                    <span
                      className="deckstats__swatch"
                      style={{ background: BUCKET_COLORS[bucket] }}
                      aria-hidden="true"
                    />
                    {CARD_BUCKET_LABELS[bucket]}
                    <b>{counts[bucket]}</b>
                  </li>
                ))}
              </ul>
            </div>
            <p className="deckstats__note">
              Mature means the card is now more than {DECK_CONFIG.matureIntervalDays} days apart -
              Anki’s line between a word you have met and a word you know.
            </p>
          </Panel>

          <Panel
            title="Reviews"
            note={`The last thirty days, by how well known each card was. ${studyStreak(
              log,
              at,
            )} day streak.`}
          >
            <StackedChart days={days} />
            <ul className="deckstats__legend deckstats__legend--row">
              {(['learning', 'relearning', 'young', 'mature'] as CardBucket[]).map((bucket) => (
                <li key={bucket}>
                  <span
                    className="deckstats__swatch"
                    style={{ background: BUCKET_COLORS[bucket] }}
                    aria-hidden="true"
                  />
                  {CARD_BUCKET_LABELS[bucket]}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Calendar" note="Every day of the last six months you answered a card.">
            <Heatmap days={calendar} />
          </Panel>

          <Panel
            title="Card ease"
            note={
              ease.average === null
                ? 'No card has graduated yet.'
                : `Average ease ${Math.round(ease.average)}%. It starts at 250% and sags toward the ` +
                  `${DECK_CONFIG.minimumEase / 10}% floor on every word you keep failing.`
            }
          >
            <BarChart
              bars={ease.bars.map((bar) => ({
                label: bar.label,
                value: bar.count,
                color: '#57b894',
              }))}
              empty="Nothing graduated yet."
            />
          </Panel>

          <Panel
            title="Intervals"
            note={
              intervals.average === null
                ? 'Nothing scheduled yet.'
                : `Average interval ${Math.round(intervals.average)} days.`
            }
          >
            <BarChart
              bars={intervals.bars.map((bar) => ({
                label: bar.label,
                value: bar.count,
                color: '#5b8def',
              }))}
              empty="Nothing scheduled yet."
            />
          </Panel>

          <Panel title="Answer buttons" note="Which button you press, by how well known the card was.">
            <table className="deckstats__table">
              <thead>
                <tr>
                  <th scope="col">Card</th>
                  {RATINGS.map((rating) => (
                    <th key={rating} scope="col">
                      {RATING_LABELS[rating]}
                    </th>
                  ))}
                  <th scope="col">Not Again</th>
                </tr>
              </thead>
              <tbody>
                {buttons.map((row) => (
                  <tr key={row.bucket}>
                    <th scope="row">{CARD_BUCKET_LABELS[row.bucket]}</th>
                    {RATINGS.map((rating) => (
                      <td key={rating}>
                        <span
                          className="deckstats__dot"
                          style={{ background: RATING_COLORS[rating] }}
                          aria-hidden="true"
                        />
                        {row.counts[rating]}
                      </td>
                    ))}
                    <td>{formatPercent(row.correct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Hourly breakdown" note="When you actually study, and how well it goes.">
            <BarChart
              bars={hours.map((bar) => ({
                label: `${bar.hour}:00`,
                value: bar.reviews,
                color: '#5b8def',
                overlay: bar.correct,
              }))}
              empty="No reviews logged yet."
              labelEvery={3}
            />
          </Panel>

          <Panel
            title="True retention"
            note="Only the first answer a card gets in a day counts, so grinding a word you just failed cannot flatter the number."
          >
            <table className="deckstats__table">
              <thead>
                <tr>
                  <th scope="col">Range</th>
                  <th scope="col">Young</th>
                  <th scope="col">Mature</th>
                </tr>
              </thead>
              <tbody>
                {retention.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>
                      {row.youngTotal === 0
                        ? '—'
                        : `${formatPercent(row.youngPassed / row.youngTotal)} of ${row.youngTotal}`}
                    </td>
                    <td>
                      {row.matureTotal === 0
                        ? '—'
                        : `${formatPercent(row.maturePassed / row.matureTotal)} of ${row.matureTotal}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      )}
    </section>
  )
}

// --- Drawing ----------------------------------------------------------------

function Panel({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: ReactNode
}) {
  return (
    <section className="deckstats__panel">
      <h2>{title}</h2>
      {note ? <p className="deckstats__note deckstats__note--lead">{note}</p> : null}
      {children}
    </section>
  )
}

type Bar = { label: string; value: number; color: string; overlay?: number | null }

/**
 * A column chart. Bars are divs rather than SVG rects so the labels wrap and
 * the whole thing reflows on a phone without any measuring.
 */
function BarChart({
  bars,
  empty = 'Nothing here yet.',
  labelEvery = 1,
}: {
  bars: Bar[]
  empty?: string
  /** Print one label in every N, so a month of columns stays readable. */
  labelEvery?: number
}) {
  const peak = Math.max(1, ...bars.map((bar) => bar.value))
  if (bars.every((bar) => bar.value === 0)) {
    return <p className="deckstats__note">{empty}</p>
  }
  return (
    <div className="deckstats__bars" role="img" aria-label={summarise(bars)}>
      {bars.map((bar, index) => (
        <div className="deckstats__bar" key={bar.label} title={`${bar.label}: ${bar.value}`}>
          <span className="deckstats__bar-value">{bar.value > 0 ? bar.value : ''}</span>
          <span className="deckstats__bar-track">
            <span
              className="deckstats__bar-fill"
              style={{
                height: `${(bar.value / peak) * 100}%`,
                background: bar.color,
              }}
            />
            {bar.overlay !== undefined && bar.overlay !== null ? (
              <span
                className="deckstats__bar-line"
                style={{ bottom: `${bar.overlay * 100}%` }}
                aria-hidden="true"
              />
            ) : null}
          </span>
          <span className="deckstats__bar-label">
            {index % labelEvery === 0 ? bar.label : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

function summarise(bars: Bar[]): string {
  const total = bars.reduce((sum, bar) => sum + bar.value, 0)
  return `${total} across ${bars.length} columns`
}

function StackedChart({ days }: { days: DayBar[] }) {
  const peak = Math.max(1, ...days.map((day) => day.total))
  if (days.every((day) => day.total === 0)) {
    return <p className="deckstats__note">No reviews in the last thirty days.</p>
  }
  const order: CardBucket[] = ['learning', 'relearning', 'young', 'mature']
  return (
    <div className="deckstats__bars" role="img" aria-label="Reviews over the last thirty days">
      {days.map((day, index) => (
        <div className="deckstats__bar" key={day.day} title={`${day.day}: ${day.total}`}>
          <span className="deckstats__bar-track">
            <span className="deckstats__stack">
              {order.map((bucket) =>
                day.buckets[bucket] > 0 ? (
                  <span
                    key={bucket}
                    style={{
                      height: `${(day.buckets[bucket] / peak) * 100}%`,
                      background: BUCKET_COLORS[bucket],
                    }}
                  />
                ) : null,
              )}
            </span>
          </span>
          <span className="deckstats__bar-label">
            {day.offset === 0 ? 'Today' : index % 5 === 0 ? day.day.slice(5) : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Anki's calendar, in weeks: one square a day, darker where the day was heavier. */
function Heatmap({ days }: { days: DayBar[] }) {
  const peak = Math.max(1, ...days.map((day) => day.total))
  return (
    <div className="deckstats__heatmap" role="img" aria-label="Study calendar">
      {days.map((day) => (
        <span
          key={day.day}
          className="deckstats__cell"
          title={`${day.day}: ${day.total} ${day.total === 1 ? 'review' : 'reviews'}`}
          style={{
            background:
              day.total === 0
                ? 'rgba(255, 255, 255, 0.06)'
                : `rgba(87, 184, 148, ${0.25 + 0.75 * (day.total / peak)})`,
          }}
        />
      ))}
    </div>
  )
}

function Donut({ counts, total }: { counts: Record<CardBucket, number>; total: number }) {
  const order: CardBucket[] = ['new', 'learning', 'relearning', 'young', 'mature']
  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <svg className="deckstats__donut" viewBox="0 0 140 140" role="img" aria-label="Card counts">
      <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="18" />
      {order.map((bucket) => {
        const share = total === 0 ? 0 : counts[bucket] / total
        const dash = share * circumference
        const element = (
          <circle
            key={bucket}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={BUCKET_COLORS[bucket]}
            strokeWidth="18"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"
          />
        )
        offset += dash
        return share > 0 ? element : null
      })}
      <text x="70" y="76" className="deckstats__donut-label">
        {total}
      </text>
    </svg>
  )
}
