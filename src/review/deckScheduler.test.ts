import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  AGAIN,
  DECK_CONFIG,
  EASY,
  GOOD,
  HARD,
  answerCard,
  createCard,
  formatDelay,
  fuzzBounds,
  isLeech,
  isMature,
  previewDelays,
  reviewInterval,
  type DeckCard,
} from './deckScheduler.ts'

const NOW = 1_700_000_000_000
const MINUTE = 60 * 1000
const DAY = 24 * 60 * 60 * 1000

/** Pin the fuzz roll to the middle of its range so intervals are exact. */
const noFuzz = () => 0.5

function card(overrides: Partial<DeckCard> = {}): DeckCard {
  return { ...createCard('core:erratic', 'core'), ...overrides }
}

function graduated(overrides: Partial<DeckCard> = {}): DeckCard {
  return card({
    phase: 'review',
    intervalDays: 10,
    ease: 2500,
    dueAt: NOW,
    reps: 4,
    graduatedAt: NOW - 10 * DAY,
    ...overrides,
  })
}

describe('learning steps', () => {
  it('walks a new card through the steps on Good and graduates it at a day', () => {
    const first = answerCard(card(), GOOD, NOW, noFuzz)
    assert.equal(first.phase, 'learning')
    assert.equal(first.step, 1)
    assert.equal(first.dueAt, NOW + 10 * MINUTE)

    const second = answerCard(first, GOOD, NOW, noFuzz)
    assert.equal(second.phase, 'review')
    assert.equal(second.intervalDays, DECK_CONFIG.graduatingIntervalDays)
    assert.equal(second.graduatedAt, NOW)
  })

  it('sends a learning card back to the first step on Again', () => {
    const stepped = answerCard(card(), GOOD, NOW, noFuzz)
    const failed = answerCard(stepped, AGAIN, NOW, noFuzz)
    assert.equal(failed.phase, 'learning')
    assert.equal(failed.step, 0)
    assert.equal(failed.dueAt, NOW + DECK_CONFIG.learningSteps[0] * MINUTE)
  })

  it('holds the step on Hard, at the average of this step and the next', () => {
    const held = answerCard(card(), HARD, NOW, noFuzz)
    assert.equal(held.phase, 'learning')
    assert.equal(held.step, 0)
    // (1m + 10m) / 2
    assert.equal(held.dueAt, NOW + 5.5 * MINUTE)
  })

  it('uses half again the last step when Hard is pressed with no step left', () => {
    const last = answerCard(card(), GOOD, NOW, noFuzz)
    const held = answerCard(last, HARD, NOW, noFuzz)
    assert.equal(held.dueAt, NOW + 15 * MINUTE)
  })

  it('graduates straight out of learning on Easy, at the easy interval', () => {
    const easy = answerCard(card(), EASY, NOW, noFuzz)
    assert.equal(easy.phase, 'review')
    assert.equal(easy.intervalDays, DECK_CONFIG.easyIntervalDays)
  })

  it('stamps the introduction on the first press and never moves it', () => {
    const first = answerCard(card(), GOOD, NOW, noFuzz)
    assert.equal(first.introducedAt, NOW)
    const later = answerCard(first, GOOD, NOW + DAY, noFuzz)
    assert.equal(later.introducedAt, NOW)
  })
})

describe('review intervals', () => {
  it('multiplies by the ease on Good', () => {
    assert.equal(reviewInterval(graduated(), GOOD, NOW), 25)
  })

  it('uses the hard multiplier on Hard, not the ease', () => {
    assert.equal(reviewInterval(graduated(), HARD, NOW), 12)
  })

  it('adds the easy bonus on Easy', () => {
    assert.equal(reviewInterval(graduated(), EASY, NOW), Math.round(10 * 2.5 * 1.3))
  })

  it('keeps the buttons in order even when the multipliers collide', () => {
    // A card down at the ease floor: 1.3x on Good is barely above 1.2x on Hard.
    const tight = graduated({ intervalDays: 1, ease: DECK_CONFIG.minimumEase })
    const hard = reviewInterval(tight, HARD, NOW)
    const good = reviewInterval(tight, GOOD, NOW)
    const easy = reviewInterval(tight, EASY, NOW)
    assert.ok(hard < good, `${hard} < ${good}`)
    assert.ok(good < easy, `${good} < ${easy}`)
  })

  it('credits overdue time back into the next interval', () => {
    const late = reviewInterval(graduated(), GOOD, NOW + 8 * DAY)
    // (10 + 8/2) * 2.5
    assert.equal(late, 35)
  })

  it('never schedules past the maximum interval', () => {
    const huge = graduated({ intervalDays: 30000 })
    assert.equal(reviewInterval(huge, EASY, NOW), DECK_CONFIG.maximumIntervalDays)
  })
})

describe('answering a review card', () => {
  it('leaves the ease alone on Good', () => {
    assert.equal(answerCard(graduated(), GOOD, NOW, noFuzz).ease, 2500)
  })

  it('drops the ease 150 on Hard and lifts it 150 on Easy', () => {
    assert.equal(answerCard(graduated(), HARD, NOW, noFuzz).ease, 2350)
    assert.equal(answerCard(graduated(), EASY, NOW, noFuzz).ease, 2650)
  })

  it('lapses into relearning on Again, with the ease down 200', () => {
    const lapsed = answerCard(graduated(), AGAIN, NOW, noFuzz)
    assert.equal(lapsed.phase, 'relearning')
    assert.equal(lapsed.step, 0)
    assert.equal(lapsed.ease, 2300)
    assert.equal(lapsed.lapses, 1)
    assert.equal(lapsed.intervalDays, DECK_CONFIG.minimumIntervalDays)
    assert.equal(lapsed.dueAt, NOW + DECK_CONFIG.relearningSteps[0] * MINUTE)
  })

  it('never lets the ease fall below the floor', () => {
    let low = graduated({ ease: DECK_CONFIG.minimumEase })
    low = answerCard(low, AGAIN, NOW, noFuzz)
    assert.equal(low.ease, DECK_CONFIG.minimumEase)
  })

  it('keeps a lapsed card graduated, so a stumble cannot lock a deck again', () => {
    const lapsed = answerCard(graduated(), AGAIN, NOW, noFuzz)
    assert.equal(lapsed.graduatedAt, NOW - 10 * DAY)
  })

  it('returns a relearning card to the schedule once its steps are done', () => {
    const lapsed = answerCard(graduated(), AGAIN, NOW, noFuzz)
    const back = answerCard(lapsed, GOOD, NOW + 10 * MINUTE, noFuzz)
    assert.equal(back.phase, 'review')
    assert.equal(back.intervalDays, DECK_CONFIG.minimumIntervalDays)
  })

  it('counts eight lapses as a leech', () => {
    assert.equal(isLeech(graduated({ lapses: 7 })), false)
    assert.equal(isLeech(graduated({ lapses: 8 })), true)
  })

  it('calls a card mature at three weeks', () => {
    assert.equal(isMature(graduated({ intervalDays: 20 })), false)
    assert.equal(isMature(graduated({ intervalDays: 21 })), true)
    assert.equal(isMature(card()), false)
  })
})

describe('fuzz', () => {
  it('leaves a one-day interval alone', () => {
    assert.deepEqual(fuzzBounds(1), [1, 1])
  })

  it('widens with the interval', () => {
    assert.deepEqual(fuzzBounds(2), [2, 3])
    assert.deepEqual(fuzzBounds(4), [3, 5])
    assert.deepEqual(fuzzBounds(100), [95, 105])
  })

  it('keeps the scheduled day inside the fuzz window', () => {
    for (const roll of [0, 0.5, 0.999]) {
      const next = answerCard(graduated(), GOOD, NOW, () => roll)
      const days = (next.dueAt - NOW) / DAY
      const [low, high] = fuzzBounds(25)
      assert.ok(days >= low && days <= high, `${days} outside ${low}-${high}`)
      // The stored interval is the schedule's intent, unfuzzed.
      assert.equal(next.intervalDays, 25)
    }
  })
})

describe('button previews', () => {
  it('shows the learning steps on a new card', () => {
    const delays = previewDelays(card(), NOW)
    assert.equal(formatDelay(delays[AGAIN]), '1m')
    assert.equal(formatDelay(delays[HARD]), '6m')
    assert.equal(formatDelay(delays[GOOD]), '10m')
    assert.equal(formatDelay(delays[EASY]), '4d')
  })

  it('shows the relearning step and the next intervals on a review card', () => {
    const delays = previewDelays(graduated(), NOW)
    assert.equal(formatDelay(delays[AGAIN]), '10m')
    assert.equal(formatDelay(delays[HARD]), '12d')
    assert.equal(formatDelay(delays[GOOD]), '25d')
    assert.equal(formatDelay(delays[EASY]), '1.1mo')
  })

  it('previews without fuzz, so the same card always quotes the same number', () => {
    const first = previewDelays(graduated(), NOW)
    const second = previewDelays(graduated(), NOW)
    assert.deepEqual(first, second)
  })
})

describe('formatDelay', () => {
  it('speaks Anki’s units', () => {
    assert.equal(formatDelay(30 * 1000), '<1m')
    assert.equal(formatDelay(90 * MINUTE), '2h')
    assert.equal(formatDelay(3 * DAY), '3d')
    assert.equal(formatDelay(45 * DAY), '1.5mo')
    assert.equal(formatDelay(400 * DAY), '1.1y')
  })
})
