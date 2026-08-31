// Anki's scheduler, ported.
//
// The saved-word ladder in dictionary/wordBank.ts is Clarity's own invention:
// four fixed rungs, two buttons, retire and be done. It suits a handful of
// words met in a passage. It does not suit four hundred cards a learner has
// never seen, because a fixed ladder can't tell an easy word from a hard one -
// it walks 'abrupt' and 'obsequious' through the same four dates.
//
// So the learning decks run the algorithm that solved this twenty years ago:
// SM-2 as Anki implements it. Four buttons - Again, Hard, Good, Easy - and a
// per-card ease factor that widens or narrows the gaps from what the learner
// actually reports. The constants below are Anki's shipped defaults, and the
// formulas are its `_nextRevIvl` / `_answerLrnCard` behaviour, so a student who
// has used Anki finds exactly the machine they already know.
//
// Everything here is pure. State lives in storage; time arrives as an argument.

/** Where a card sits in the pipeline. Anki's queue names, same meanings. */
export type CardPhase = 'new' | 'learning' | 'review' | 'relearning'

/** The four buttons, in Anki's order and with Anki's numbering. */
export type Rating = 1 | 2 | 3 | 4

export const AGAIN: Rating = 1
export const HARD: Rating = 2
export const GOOD: Rating = 3
export const EASY: Rating = 4

export const RATINGS: Rating[] = [AGAIN, HARD, GOOD, EASY]

export const RATING_LABELS: Record<Rating, string> = {
  1: 'Again',
  2: 'Hard',
  3: 'Good',
  4: 'Easy',
}

export type DeckCard = {
  /** `deckId:word-slug` - matches the id in the deck catalogue. */
  id: string
  deckId: string
  phase: CardPhase
  /** Position on the learning (or relearning) step ladder. */
  step: number
  /** Review interval in days. Zero until the card first graduates. */
  intervalDays: number
  /** Ease factor in permille, Anki style: 2500 means 250%. */
  ease: number
  dueAt: number
  /** Every button press on this card, lapses included. */
  reps: number
  /** Times a graduated card was failed. Eight makes it a leech. */
  lapses: number
  introducedAt: number | null
  /** When the card first left learning. Null while it never has. */
  graduatedAt: number | null
  lastReviewedAt: number | null
}

const MINUTE = 60 * 1000
const DAY = 24 * 60 * 60 * 1000

/**
 * Anki's default deck preset, with one deliberate change: fifteen new cards a
 * day rather than twenty, so the All-Around deck lands in twenty-four sittings
 * instead of eighteen and the daily review load stays under half an hour.
 */
export const DECK_CONFIG = {
  newPerDay: 15,
  maxReviewsPerDay: 200,
  /** Minutes. A new card is seen now, then ten minutes later, then it leaves. */
  learningSteps: [1, 10],
  /** Minutes. Where a failed review card goes to be rebuilt. */
  relearningSteps: [10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  startingEase: 2500,
  easyBonus: 1.3,
  hardMultiplier: 1.2,
  intervalModifier: 1,
  /** Anki's "new interval" on a lapse: 0% of the old one. */
  lapseMultiplier: 0,
  minimumIntervalDays: 1,
  maximumIntervalDays: 36500,
  minimumEase: 1300,
  leechThreshold: 8,
  /** Anki's learn-ahead limit: with nothing else left, pull learning cards
   *  due within twenty minutes forward rather than ending the session. */
  learnAheadMinutes: 20,
  /** An interval this long or longer makes a card "mature" in the stats. */
  matureIntervalDays: 21,
} as const

/** Ease change per button, in permille. Good leaves the ease alone. */
const EASE_DELTA: Record<Rating, number> = { 1: -200, 2: -150, 3: 0, 4: 150 }

export function createCard(id: string, deckId: string): DeckCard {
  return {
    id,
    deckId,
    phase: 'new',
    step: 0,
    intervalDays: 0,
    ease: DECK_CONFIG.startingEase,
    dueAt: 0,
    reps: 0,
    lapses: 0,
    introducedAt: null,
    graduatedAt: null,
    lastReviewedAt: null,
  }
}

export function isLeech(card: DeckCard): boolean {
  return card.lapses >= DECK_CONFIG.leechThreshold
}

export function isMature(card: DeckCard): boolean {
  return card.phase === 'review' && card.intervalDays >= DECK_CONFIG.matureIntervalDays
}

// --- Fuzz -------------------------------------------------------------------

/**
 * Anki's interval fuzz. Without it, everything answered on the same day comes
 * back on the same day forever, and one heavy session echoes down the calendar
 * for months. The bounds are Anki's `fuzz_bounds`.
 */
export function fuzzBounds(intervalDays: number): [number, number] {
  if (intervalDays < 2) return [1, 1]
  if (intervalDays === 2) return [2, 3]
  let spread: number
  if (intervalDays < 7) spread = intervalDays * 0.25
  else if (intervalDays < 30) spread = Math.max(2, intervalDays * 0.15)
  else spread = Math.max(4, intervalDays * 0.05)
  spread = Math.max(spread, 1)
  return [Math.round(intervalDays - spread), Math.round(intervalDays + spread)]
}

/** `random` is injectable so tests can pin the roll; production passes Math.random. */
export function applyFuzz(intervalDays: number, random: () => number): number {
  const [low, high] = fuzzBounds(intervalDays)
  if (high <= low) return low
  return low + Math.floor(random() * (high - low + 1))
}

// --- Learning steps ---------------------------------------------------------

function stepsFor(phase: CardPhase): readonly number[] {
  return phase === 'relearning' ? DECK_CONFIG.relearningSteps : DECK_CONFIG.learningSteps
}

/**
 * Anki's Hard delay inside learning: the average of the current step and the
 * next one, or half again the current step when there is no next one.
 */
function hardStepMinutes(steps: readonly number[], step: number): number {
  const current = steps[Math.min(step, steps.length - 1)]
  const next = steps[step + 1]
  return next === undefined ? current * 1.5 : (current + next) / 2
}

// --- Review intervals -------------------------------------------------------

function clampInterval(days: number): number {
  return Math.min(
    DECK_CONFIG.maximumIntervalDays,
    Math.max(DECK_CONFIG.minimumIntervalDays, Math.round(days)),
  )
}

/**
 * Anki's next review interval, delay bonus included: a card answered late was
 * remembered over a longer gap than it was scheduled for, and Hard/Good/Easy
 * each credit a share of that overdue time back into the next interval.
 */
export function reviewInterval(card: DeckCard, rating: Rating, now: number): number {
  const overdueDays = Math.max(0, (now - card.dueAt) / DAY)
  const factor = card.ease / 1000
  const modifier = DECK_CONFIG.intervalModifier

  if (rating === HARD) {
    return clampInterval(
      (card.intervalDays + overdueDays * 0.25) * DECK_CONFIG.hardMultiplier * modifier,
    )
  }
  const hard = clampInterval(
    (card.intervalDays + overdueDays * 0.25) * DECK_CONFIG.hardMultiplier * modifier,
  )
  const good = atLeast(
    hard + 1,
    clampInterval((card.intervalDays + overdueDays * 0.5) * factor * modifier),
  )
  if (rating === GOOD) return good
  return atLeast(
    good + 1,
    clampInterval((card.intervalDays + overdueDays) * factor * DECK_CONFIG.easyBonus * modifier),
  )
}

/**
 * Anki keeps the buttons in order - Easy always further out than Good, Good
 * than Hard - even when the multipliers would collide at a low ease. The
 * ceiling still wins, so a card already at the maximum stays there.
 */
function atLeast(floor: number, interval: number): number {
  return Math.min(DECK_CONFIG.maximumIntervalDays, Math.max(floor, interval))
}

// --- Answering --------------------------------------------------------------

function withEase(card: DeckCard, rating: Rating): number {
  return Math.max(DECK_CONFIG.minimumEase, card.ease + EASE_DELTA[rating])
}

function graduate(card: DeckCard, intervalDays: number, now: number, random: () => number): DeckCard {
  const interval = clampInterval(intervalDays)
  return {
    ...card,
    phase: 'review',
    step: 0,
    intervalDays: interval,
    dueAt: now + applyFuzz(interval, random) * DAY,
    graduatedAt: card.graduatedAt ?? now,
  }
}

function answerLearning(
  card: DeckCard,
  rating: Rating,
  now: number,
  random: () => number,
): DeckCard {
  const phase: CardPhase = card.phase === 'relearning' ? 'relearning' : 'learning'
  const steps = stepsFor(phase)

  if (rating === AGAIN) {
    return { ...card, phase, step: 0, dueAt: now + steps[0] * MINUTE }
  }
  if (rating === HARD) {
    return { ...card, phase, dueAt: now + hardStepMinutes(steps, card.step) * MINUTE }
  }
  if (rating === GOOD) {
    const next = card.step + 1
    if (next < steps.length) {
      return { ...card, phase, step: next, dueAt: now + steps[next] * MINUTE }
    }
    // Out of steps. A relearning card returns to the interval its lapse left
    // it with; a new card graduates on the graduating interval.
    return graduate(
      card,
      phase === 'relearning' ? card.intervalDays : DECK_CONFIG.graduatingIntervalDays,
      now,
      random,
    )
  }
  // Easy skips whatever steps are left. Anki gives a relearning card its lapsed
  // interval plus the easy bonus; a new card takes the flat easy interval.
  return graduate(
    card,
    phase === 'relearning'
      ? card.intervalDays * DECK_CONFIG.easyBonus
      : DECK_CONFIG.easyIntervalDays,
    now,
    random,
  )
}

function answerReview(card: DeckCard, rating: Rating, now: number, random: () => number): DeckCard {
  if (rating === AGAIN) {
    // A lapse. The ease drops, the interval collapses to the lapse multiplier
    // (zero by default, floored at a day), and the card goes back through the
    // relearning steps before it counts as known again.
    const lapsedInterval = clampInterval(card.intervalDays * DECK_CONFIG.lapseMultiplier)
    return {
      ...card,
      phase: 'relearning',
      step: 0,
      ease: withEase(card, AGAIN),
      intervalDays: lapsedInterval,
      lapses: card.lapses + 1,
      dueAt: now + DECK_CONFIG.relearningSteps[0] * MINUTE,
    }
  }
  const interval = reviewInterval(card, rating, now)
  return {
    ...card,
    phase: 'review',
    step: 0,
    ease: withEase(card, rating),
    intervalDays: interval,
    dueAt: now + applyFuzz(interval, random) * DAY,
  }
}

/**
 * Press a button. Returns the card as it now stands - the caller writes it and
 * files the matching revlog entry.
 */
export function answerCard(
  card: DeckCard,
  rating: Rating,
  now: number,
  random: () => number = Math.random,
): DeckCard {
  const seen: DeckCard = {
    ...card,
    reps: card.reps + 1,
    lastReviewedAt: now,
    introducedAt: card.introducedAt ?? now,
  }
  const next =
    seen.phase === 'review'
      ? answerReview(seen, rating, now, random)
      : answerLearning(seen, rating, now, random)
  return next
}

/**
 * What each button would do, in milliseconds from now - the delays Anki prints
 * above the buttons so the learner can see the cost of each answer.
 */
export function previewDelays(card: DeckCard, now: number): Record<Rating, number> {
  const delays = {} as Record<Rating, number>
  for (const rating of RATINGS) {
    // Preview without fuzz: the number shown should be the schedule's intent,
    // not one sample of it.
    const next = answerCard(card, rating, now, () => 0.5)
    delays[rating] =
      next.phase === 'review'
        ? Math.max(DECK_CONFIG.minimumIntervalDays, next.intervalDays) * DAY
        : Math.max(0, next.dueAt - now)
  }
  return delays
}

/** "10m", "1d", "3.2mo" - Anki's terse button labels. */
export function formatDelay(ms: number): string {
  const minutes = ms / MINUTE
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)}h`
  const days = ms / DAY
  if (days < 30) return `${Math.round(days)}d`
  const months = days / 30.417
  if (months < 12) return `${round1(months)}mo`
  return `${round1(days / 365)}y`
}

function round1(value: number): string {
  return value >= 10 ? `${Math.round(value)}` : `${Math.round(value * 10) / 10}`
}
