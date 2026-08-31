import { dayKey } from './daily.ts'
import {
  DECK_CONFIG,
  createCard,
  type CardPhase,
  type DeckCard,
  type Rating,
} from './deckScheduler.ts'

// What the deck hands you next, and how much of it a day is allowed to hold.
//
// Anki's session is not a fixed list. A card answered Again is due in a minute
// and comes back inside the same sitting, so the queue is recomputed after
// every button press rather than dealt out up front. That is what nextCard does
// here: given the deck's cards and the day's counters, it names the one card to
// show now.

const MINUTE = 60 * 1000

/** One row of the review log - every button press, kept for the analysis screen. */
export type DeckReview = {
  cardId: string
  deckId: string
  at: number
  rating: Rating
  /** The phase the card was in when the button was pressed. */
  phase: CardPhase
  /** Interval in days before the answer, and after it. */
  lastIntervalDays: number
  intervalDays: number
  /** Ease after the answer, in permille. */
  ease: number
  /** Time on the card, in milliseconds. */
  tookMs: number
}

export type DeckCounts = {
  /** Never seen. */
  new: number
  /** In learning or relearning, whether or not due yet. */
  learning: number
  /** Graduated and due now. */
  due: number
  /** Graduated, not due yet. */
  scheduled: number
  /** Total cards in the deck. */
  total: number
  /** Cards that have graduated at least once. */
  graduated: number
  /** New cards today's limit still allows. */
  newRemaining: number
  /** Everything the deck would hand you right now. */
  readyNow: number
}

/**
 * Cards for a deck, in catalogue order, materialising any the learner has
 * never met. Keeping unseen cards out of storage until they are answered means
 * a fresh install carries no state at all.
 */
export function deckCards(
  cardIds: string[],
  deckId: string,
  saved: Record<string, DeckCard>,
): DeckCard[] {
  return cardIds.map((id) => saved[id] ?? createCard(id, deckId))
}

/** Button presses filed today, by deck. The day rolls at 4am, as Reflect does. */
export function reviewsToday(log: DeckReview[], deckId: string, now: number): DeckReview[] {
  const today = dayKey(now)
  return log.filter((entry) => entry.deckId === deckId && dayKey(entry.at) === today)
}

/**
 * New cards introduced today. Counted from the log rather than a separate
 * tally, because the log is written on the same press that introduces the card
 * and so cannot drift out of step with it.
 */
export function newIntroducedToday(log: DeckReview[], deckId: string, now: number): number {
  const seen = new Set<string>()
  for (const entry of reviewsToday(log, deckId, now)) {
    if (entry.phase === 'new') seen.add(entry.cardId)
  }
  return seen.size
}

export function countDeck(
  cards: DeckCard[],
  log: DeckReview[],
  deckId: string,
  now: number,
): DeckCounts {
  const counts: DeckCounts = {
    new: 0,
    learning: 0,
    due: 0,
    scheduled: 0,
    total: cards.length,
    graduated: 0,
    newRemaining: 0,
    readyNow: 0,
  }
  for (const card of cards) {
    if (card.graduatedAt !== null) counts.graduated += 1
    if (card.phase === 'new') counts.new += 1
    else if (card.phase === 'review') {
      if (card.dueAt <= now) counts.due += 1
      else counts.scheduled += 1
    } else counts.learning += 1
  }
  counts.newRemaining = Math.max(
    0,
    Math.min(counts.new, DECK_CONFIG.newPerDay - newIntroducedToday(log, deckId, now)),
  )
  counts.readyNow = readyCards(cards, log, deckId, now).length
  return counts
}

/**
 * Everything the deck would show in this sitting: learning cards that have come
 * around, review cards that are due (up to the day's review ceiling), and as
 * many unseen cards as the day's new-card allowance still permits.
 */
export function readyCards(
  cards: DeckCard[],
  log: DeckReview[],
  deckId: string,
  now: number,
): DeckCard[] {
  const today = reviewsToday(log, deckId, now)
  const reviewsLeft = Math.max(
    0,
    DECK_CONFIG.maxReviewsPerDay - today.filter((entry) => entry.phase === 'review').length,
  )
  const newLeft = Math.max(0, DECK_CONFIG.newPerDay - newIntroducedToday(log, deckId, now))

  const learning: DeckCard[] = []
  const due: DeckCard[] = []
  const fresh: DeckCard[] = []
  for (const card of cards) {
    if (card.phase === 'new') fresh.push(card)
    else if (card.phase === 'review') {
      if (card.dueAt <= now) due.push(card)
    } else if (card.dueAt <= now + DECK_CONFIG.learnAheadMinutes * MINUTE) learning.push(card)
  }

  learning.sort((a, b) => a.dueAt - b.dueAt)
  due.sort((a, b) => a.dueAt - b.dueAt)

  return [...learning, ...due.slice(0, reviewsLeft), ...fresh.slice(0, newLeft)]
}

/**
 * The single card to show now.
 *
 * Order of precedence matches Anki's v3 scheduler closely enough to feel the
 * same: a learning card that has actually come due beats everything, then due
 * reviews and new cards are mixed so a sitting is not four hundred unseen words
 * followed by nothing; only when the queue is otherwise empty is a learning
 * card pulled forward inside the learn-ahead window.
 *
 * `avoid` is the card just answered: with two cards left it stops the same one
 * being handed straight back, which reads as a bug even when it is correct.
 */
export function nextCard(
  cards: DeckCard[],
  log: DeckReview[],
  deckId: string,
  now: number,
  avoid: string | null = null,
): DeckCard | null {
  const ready = readyCards(cards, log, deckId, now)
  if (ready.length === 0) return null

  const dueLearning = ready.filter((card) => card.phase !== 'review' && card.phase !== 'new' && card.dueAt <= now)
  const dueReviews = ready.filter((card) => card.phase === 'review')
  const fresh = ready.filter((card) => card.phase === 'new')
  const aheadLearning = ready.filter(
    (card) => card.phase !== 'review' && card.phase !== 'new' && card.dueAt > now,
  )

  // Mix new cards evenly through the due reviews rather than stacking them at
  // one end: Anki's default new-card gather mode, and the reason a session
  // feels varied instead of front-loaded.
  const mixed = interleave(dueReviews, fresh)
  const order = [...dueLearning, ...mixed, ...aheadLearning]

  if (avoid !== null && order.length > 1 && order[0].id === avoid) return order[1]
  return order[0]
}

function interleave(primary: DeckCard[], secondary: DeckCard[]): DeckCard[] {
  if (secondary.length === 0) return primary
  if (primary.length === 0) return secondary
  const out: DeckCard[] = []
  const gap = primary.length / secondary.length
  let taken = 0
  primary.forEach((card, index) => {
    out.push(card)
    while (taken < secondary.length && (taken + 1) * gap <= index + 1) {
      out.push(secondary[taken])
      taken += 1
    }
  })
  while (taken < secondary.length) {
    out.push(secondary[taken])
    taken += 1
  }
  return out
}
