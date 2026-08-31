import { dayKey, previousDayKey } from './daily.ts'
import type { DeckReview } from './deckQueue.ts'
import { DECK_CONFIG, type DeckCard, type Rating } from './deckScheduler.ts'

// The numbers behind the analysis screen.
//
// Anki's statistics page answers three different questions, and the split is
// worth keeping in mind because it decides what each graph is drawn from:
//
//   what do I own?      - Card Counts, Ease, Intervals: read off the cards.
//   what did I do?      - Reviews, Calendar, Hourly, Answer Buttons: read off
//                         the review log, which is why the log exists.
//   what is coming?     - Future Due: read off the cards' due dates.
//
// Everything here is a pure fold over those two inputs. `now` arrives as an
// argument so the demo clock moves the graphs the same way it moves the deck.

const DAY = 24 * 60 * 60 * 1000

/** Anki's card buckets, in the order its pie chart lists them. */
export type CardBucket = 'new' | 'learning' | 'relearning' | 'young' | 'mature'

export const CARD_BUCKET_LABELS: Record<CardBucket, string> = {
  new: 'New',
  learning: 'Learning',
  relearning: 'Relearning',
  young: 'Young',
  mature: 'Mature',
}

export function cardBucket(card: DeckCard): CardBucket {
  if (card.phase === 'new') return 'new'
  if (card.phase === 'learning') return 'learning'
  if (card.phase === 'relearning') return 'relearning'
  return card.intervalDays >= DECK_CONFIG.matureIntervalDays ? 'mature' : 'young'
}

/**
 * The bucket a *review* belongs to - decided by where the card stood when the
 * button was pressed, not where it stands now. A card answered while young and
 * matured by that answer counts as a young review, the way Anki counts it.
 */
export function reviewBucket(entry: DeckReview): CardBucket {
  if (entry.phase === 'new') return 'learning'
  if (entry.phase === 'learning') return 'learning'
  if (entry.phase === 'relearning') return 'relearning'
  return entry.lastIntervalDays >= DECK_CONFIG.matureIntervalDays ? 'mature' : 'young'
}

/** Anki treats Again as the only failure; Hard, Good and Easy all pass. */
export function isPass(rating: Rating): boolean {
  return rating !== 1
}

// --- Today ------------------------------------------------------------------

export type TodayStats = {
  reviews: number
  cards: number
  timeMs: number
  again: number
  /** Share of today's reviews that were not Again, 0-1. Null with no reviews. */
  correct: number | null
  newIntroduced: number
  learning: number
  review: number
  relearning: number
}

export function todayStats(log: DeckReview[], now: number): TodayStats {
  const today = dayKey(now)
  const rows = log.filter((entry) => dayKey(entry.at) === today)
  const stats: TodayStats = {
    reviews: rows.length,
    cards: new Set(rows.map((entry) => entry.cardId)).size,
    timeMs: rows.reduce((total, entry) => total + entry.tookMs, 0),
    again: rows.filter((entry) => entry.rating === 1).length,
    correct: null,
    newIntroduced: new Set(rows.filter((e) => e.phase === 'new').map((e) => e.cardId)).size,
    learning: rows.filter((entry) => entry.phase === 'new' || entry.phase === 'learning').length,
    review: rows.filter((entry) => entry.phase === 'review').length,
    relearning: rows.filter((entry) => entry.phase === 'relearning').length,
  }
  if (rows.length > 0) stats.correct = (rows.length - stats.again) / rows.length
  return stats
}

// --- Future due -------------------------------------------------------------

export type FutureDueBar = {
  /** Days from today. Zero is today, including anything overdue. */
  offset: number
  count: number
  cumulative: number
}

/**
 * What the next `days` days owe if nothing is failed and nothing new is added.
 * Overdue cards all land on day zero, which is exactly how a backlog reads.
 */
export function futureDue(cards: DeckCard[], now: number, days = 30): FutureDueBar[] {
  const bars: FutureDueBar[] = []
  const counts = new Array<number>(days + 1).fill(0)
  for (const card of cards) {
    if (card.phase === 'new') continue
    const offset = Math.max(0, Math.ceil((card.dueAt - now) / DAY))
    if (offset <= days) counts[offset] += 1
  }
  let running = 0
  for (let offset = 0; offset <= days; offset += 1) {
    running += counts[offset]
    bars.push({ offset, count: counts[offset], cumulative: running })
  }
  return bars
}

/**
 * Anki's "daily load": the average number of reviews a day this deck will ask
 * for once it settles, being the sum of 1/interval over every scheduled card.
 */
export function dailyLoad(cards: DeckCard[]): number {
  return cards.reduce((total, card) => {
    if (card.phase === 'new') return total
    return total + 1 / Math.max(1, card.intervalDays)
  }, 0)
}

// --- Calendar and reviews ---------------------------------------------------

export type DayBar = {
  day: string
  /** Days back from today. Zero is today. */
  offset: number
  total: number
  timeMs: number
  buckets: Record<CardBucket, number>
}

/** One row per day for the last `days` days, most distant first. */
export function reviewsByDay(log: DeckReview[], now: number, days = 30): DayBar[] {
  const byDay = new Map<string, DeckReview[]>()
  for (const entry of log) {
    const key = dayKey(entry.at)
    const bucket = byDay.get(key)
    if (bucket) bucket.push(entry)
    else byDay.set(key, [entry])
  }

  const keys: string[] = []
  let key = dayKey(now)
  for (let index = 0; index < days; index += 1) {
    keys.push(key)
    key = previousDayKey(key)
  }

  return keys
    .map((day, offset) => {
      const rows = byDay.get(day) ?? []
      const buckets: Record<CardBucket, number> = {
        new: 0,
        learning: 0,
        relearning: 0,
        young: 0,
        mature: 0,
      }
      for (const entry of rows) buckets[reviewBucket(entry)] += 1
      return {
        day,
        offset,
        total: rows.length,
        timeMs: rows.reduce((total, entry) => total + entry.tookMs, 0),
        buckets,
      }
    })
    .reverse()
}

/** The heatmap: how many reviews on each day of the last `days` days. */
export function calendarDays(log: DeckReview[], now: number, days = 182): DayBar[] {
  return reviewsByDay(log, now, days)
}

/** Consecutive days ending today (or yesterday) with at least one review. */
export function studyStreak(log: DeckReview[], now: number): number {
  const active = new Set(log.map((entry) => dayKey(entry.at)))
  let key = dayKey(now)
  if (!active.has(key)) {
    key = previousDayKey(key)
    if (!active.has(key)) return 0
  }
  let streak = 0
  while (active.has(key)) {
    streak += 1
    key = previousDayKey(key)
  }
  return streak
}

// --- Card counts, ease, intervals -------------------------------------------

export function cardCounts(cards: DeckCard[]): Record<CardBucket, number> {
  const counts: Record<CardBucket, number> = {
    new: 0,
    learning: 0,
    relearning: 0,
    young: 0,
    mature: 0,
  }
  for (const card of cards) counts[cardBucket(card)] += 1
  return counts
}

export type Histogram = {
  bars: Array<{ label: string; value: number; count: number }>
  average: number | null
}

/**
 * Ease factors of the graduated cards, in Anki's 10% buckets. A deck whose
 * average ease has sagged toward the 130% floor is a deck of cards that keep
 * being failed - the single most useful number on the whole screen.
 */
export function easeHistogram(cards: DeckCard[]): Histogram {
  const graduated = cards.filter((card) => card.phase === 'review' || card.phase === 'relearning')
  const buckets = new Map<number, number>()
  for (const card of graduated) {
    const percent = Math.round(card.ease / 10)
    const bucket = Math.floor(percent / 10) * 10
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
  }
  const bars = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, count]) => ({ label: `${bucket}%`, value: bucket, count }))
  const average =
    graduated.length === 0
      ? null
      : graduated.reduce((total, card) => total + card.ease, 0) / graduated.length / 10
  return { bars, average }
}

/** How far apart the deck's cards now sit, bucketed by days. */
export function intervalHistogram(cards: DeckCard[]): Histogram {
  const scheduled = cards.filter((card) => card.phase === 'review')
  const edges = [1, 2, 4, 7, 14, 21, 30, 60, 90, 180, 365]
  const bars = edges.map((edge, index) => {
    const next = edges[index + 1] ?? Infinity
    const count = scheduled.filter(
      (card) => card.intervalDays >= edge && card.intervalDays < next,
    ).length
    return {
      label: next === Infinity ? `${edge}d+` : `${edge}-${next - 1}d`,
      value: edge,
      count,
    }
  })
  const average =
    scheduled.length === 0
      ? null
      : scheduled.reduce((total, card) => total + card.intervalDays, 0) / scheduled.length
  return { bars, average }
}

// --- Answer buttons and hours ------------------------------------------------

export type AnswerButtonRow = {
  bucket: CardBucket
  counts: Record<Rating, number>
  total: number
  /** Share of presses on this bucket that were not Again, 0-1. */
  correct: number | null
}

/** Which button was pressed, split by how well known the card was at the time. */
export function answerButtons(log: DeckReview[]): AnswerButtonRow[] {
  const order: CardBucket[] = ['learning', 'young', 'mature', 'relearning']
  return order.map((bucket) => {
    const rows = log.filter((entry) => reviewBucket(entry) === bucket)
    const counts: Record<Rating, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    for (const entry of rows) counts[entry.rating] += 1
    return {
      bucket,
      counts,
      total: rows.length,
      correct: rows.length === 0 ? null : (rows.length - counts[1]) / rows.length,
    }
  })
}

export type HourBar = {
  hour: number
  reviews: number
  correct: number | null
}

/** Reviews and pass rate by hour of the day - when this learner actually works. */
export function hourlyBreakdown(log: DeckReview[]): HourBar[] {
  const bars: HourBar[] = []
  for (let hour = 0; hour < 24; hour += 1) {
    const rows = log.filter((entry) => new Date(entry.at).getHours() === hour)
    bars.push({
      hour,
      reviews: rows.length,
      correct: rows.length === 0 ? null : rows.filter((e) => isPass(e.rating)).length / rows.length,
    })
  }
  return bars
}

// --- True retention ----------------------------------------------------------

export type RetentionRow = {
  label: string
  youngPassed: number
  youngTotal: number
  maturePassed: number
  matureTotal: number
}

const RETENTION_RANGES: Array<{ label: string; days: number | null }> = [
  { label: 'Today', days: 1 },
  { label: 'Past week', days: 7 },
  { label: 'Past month', days: 30 },
  { label: 'Past year', days: 365 },
  { label: 'All time', days: null },
]

/**
 * True retention: of the graduated cards that came back, how many were still
 * known. Only the first answer a card gets in a day counts, so grinding a card
 * you have just failed cannot flatter the number - Anki's rule, and the reason
 * this reads lower (and truer) than the pass rate in the Today panel.
 */
export function trueRetention(log: DeckReview[], now: number): RetentionRow[] {
  const graduated = log.filter((entry) => entry.phase === 'review')
  const firstOfDay = new Map<string, DeckReview>()
  for (const entry of [...graduated].sort((a, b) => a.at - b.at)) {
    const key = `${dayKey(entry.at)}:${entry.cardId}`
    if (!firstOfDay.has(key)) firstOfDay.set(key, entry)
  }
  const rows = [...firstOfDay.values()]

  return RETENTION_RANGES.map(({ label, days }) => {
    const since = days === null ? -Infinity : now - days * DAY
    const inRange = rows.filter((entry) => entry.at >= since)
    const young = inRange.filter((entry) => reviewBucket(entry) === 'young')
    const mature = inRange.filter((entry) => reviewBucket(entry) === 'mature')
    return {
      label,
      youngPassed: young.filter((entry) => isPass(entry.rating)).length,
      youngTotal: young.length,
      maturePassed: mature.filter((entry) => isPass(entry.rating)).length,
      matureTotal: mature.length,
    }
  })
}

// --- Formatting --------------------------------------------------------------

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = seconds / 60
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = minutes / 60
  return `${Math.round(hours * 10) / 10}h`
}

export function formatPercent(share: number | null): string {
  return share === null ? '—' : `${Math.round(share * 100)}%`
}
