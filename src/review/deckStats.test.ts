import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { DeckReview } from './deckQueue.ts'
import { createCard, type CardPhase, type DeckCard, type Rating } from './deckScheduler.ts'
import {
  answerButtons,
  cardBucket,
  cardCounts,
  dailyLoad,
  easeHistogram,
  formatDuration,
  formatPercent,
  futureDue,
  hourlyBreakdown,
  intervalHistogram,
  reviewBucket,
  reviewsByDay,
  studyStreak,
  todayStats,
  trueRetention,
} from './deckStats.ts'

const NOW = new Date(2026, 7, 30, 12, 0, 0).getTime()
const DAY = 24 * 60 * 60 * 1000

function card(id: string, overrides: Partial<DeckCard> = {}): DeckCard {
  return { ...createCard(id, 'core'), ...overrides }
}

function review(overrides: Partial<DeckReview> = {}): DeckReview {
  return {
    cardId: 'core:a',
    deckId: 'core',
    at: NOW,
    rating: 3 as Rating,
    phase: 'review' as CardPhase,
    lastIntervalDays: 5,
    intervalDays: 12,
    ease: 2500,
    tookMs: 4000,
    ...overrides,
  }
}

describe('buckets', () => {
  it('calls a card mature at three weeks and young below it', () => {
    assert.equal(cardBucket(card('a')), 'new')
    assert.equal(cardBucket(card('a', { phase: 'learning' })), 'learning')
    assert.equal(cardBucket(card('a', { phase: 'relearning' })), 'relearning')
    assert.equal(cardBucket(card('a', { phase: 'review', intervalDays: 20 })), 'young')
    assert.equal(cardBucket(card('a', { phase: 'review', intervalDays: 21 })), 'mature')
  })

  it('buckets a review by where the card stood when the button was pressed', () => {
    // Answered young, matured by the answer: still a young review.
    assert.equal(reviewBucket(review({ lastIntervalDays: 10, intervalDays: 25 })), 'young')
    assert.equal(reviewBucket(review({ lastIntervalDays: 30, intervalDays: 75 })), 'mature')
    assert.equal(reviewBucket(review({ phase: 'new' })), 'learning')
  })
})

describe('todayStats', () => {
  it('counts presses, cards, time and the Again rate for the study day', () => {
    const log = [
      review({ cardId: 'core:a', rating: 1, tookMs: 6000 }),
      review({ cardId: 'core:a', rating: 3, tookMs: 3000 }),
      review({ cardId: 'core:b', rating: 3, phase: 'new', tookMs: 1000 }),
      review({ cardId: 'core:c', at: NOW - 3 * DAY }),
    ]
    const stats = todayStats(log, NOW)
    assert.equal(stats.reviews, 3)
    assert.equal(stats.cards, 2)
    assert.equal(stats.timeMs, 10000)
    assert.equal(stats.again, 1)
    assert.equal(stats.correct, 2 / 3)
    assert.equal(stats.newIntroduced, 1)
    assert.equal(stats.review, 2)
    assert.equal(stats.learning, 1)
  })

  it('reports no rate at all on a day with no reviews', () => {
    assert.equal(todayStats([], NOW).correct, null)
  })
})

describe('futureDue', () => {
  it('piles everything overdue onto today', () => {
    const cards = [
      card('a', { phase: 'review', dueAt: NOW - 9 * DAY, intervalDays: 3 }),
      card('b', { phase: 'review', dueAt: NOW - DAY, intervalDays: 3 }),
      card('c', { phase: 'review', dueAt: NOW + 2 * DAY, intervalDays: 3 }),
      card('d'),
    ]
    const bars = futureDue(cards, NOW, 5)
    assert.equal(bars[0].count, 2)
    assert.equal(bars[2].count, 1)
    assert.equal(bars[5].cumulative, 3)
  })

  it('leaves unseen cards out - they are not owed until they are met', () => {
    assert.equal(futureDue([card('a')], NOW, 5)[0].count, 0)
  })

  it('sums the daily load as one over each interval', () => {
    const cards = [
      card('a', { phase: 'review', intervalDays: 2 }),
      card('b', { phase: 'review', intervalDays: 4 }),
      card('c'),
    ]
    assert.equal(dailyLoad(cards), 0.75)
  })
})

describe('reviewsByDay', () => {
  it('returns one row per day, oldest first, split by bucket', () => {
    const log = [
      review({ at: NOW, lastIntervalDays: 30 }),
      review({ at: NOW, lastIntervalDays: 3 }),
      review({ at: NOW - DAY, phase: 'new' }),
    ]
    const bars = reviewsByDay(log, NOW, 3)
    assert.equal(bars.length, 3)
    assert.equal(bars[2].offset, 0)
    assert.equal(bars[2].total, 2)
    assert.equal(bars[2].buckets.mature, 1)
    assert.equal(bars[2].buckets.young, 1)
    assert.equal(bars[1].buckets.learning, 1)
  })

  it('counts a run of days ending today as a streak', () => {
    const log = [review({ at: NOW }), review({ at: NOW - DAY }), review({ at: NOW - 2 * DAY })]
    assert.equal(studyStreak(log, NOW), 3)
  })

  it('lets yesterday hold the streak, but not the day before', () => {
    assert.equal(studyStreak([review({ at: NOW - DAY })], NOW), 1)
    assert.equal(studyStreak([review({ at: NOW - 2 * DAY })], NOW), 0)
  })
})

describe('card counts and histograms', () => {
  it('sorts the deck the way the pie chart does', () => {
    const counts = cardCounts([
      card('a'),
      card('b', { phase: 'learning' }),
      card('c', { phase: 'review', intervalDays: 4 }),
      card('d', { phase: 'review', intervalDays: 40 }),
    ])
    assert.deepEqual(counts, { new: 1, learning: 1, relearning: 0, young: 1, mature: 1 })
  })

  it('buckets ease by ten points and reports the average', () => {
    const histogram = easeHistogram([
      card('a', { phase: 'review', ease: 2500 }),
      card('b', { phase: 'review', ease: 2300 }),
    ])
    assert.deepEqual(
      histogram.bars.map((bar) => [bar.label, bar.count]),
      [['230%', 1], ['250%', 1]],
    )
    assert.equal(histogram.average, 240)
  })

  it('has no ease to report before anything graduates', () => {
    assert.equal(easeHistogram([card('a')]).average, null)
  })

  it('buckets intervals and averages only the scheduled cards', () => {
    const histogram = intervalHistogram([
      card('a', { phase: 'review', intervalDays: 1 }),
      card('b', { phase: 'review', intervalDays: 25 }),
      card('c'),
    ])
    assert.equal(histogram.average, 13)
    assert.equal(histogram.bars[0].count, 1)
    assert.equal(histogram.bars.find((bar) => bar.value === 21)?.count, 1)
  })
})

describe('answer buttons and hours', () => {
  it('splits button presses by how well known the card was', () => {
    const rows = answerButtons([
      review({ rating: 1, lastIntervalDays: 30 }),
      review({ rating: 3, lastIntervalDays: 30 }),
      review({ rating: 4, lastIntervalDays: 2 }),
      review({ rating: 3, phase: 'relearning' }),
    ])
    const mature = rows.find((row) => row.bucket === 'mature')
    assert.equal(mature?.total, 2)
    assert.equal(mature?.counts[1], 1)
    assert.equal(mature?.correct, 0.5)
    assert.equal(rows.find((row) => row.bucket === 'young')?.counts[4], 1)
    assert.equal(rows.find((row) => row.bucket === 'relearning')?.total, 1)
  })

  it('lays reviews out across the twenty-four hours', () => {
    const nine = new Date(2026, 7, 30, 9, 30, 0).getTime()
    const bars = hourlyBreakdown([review({ at: nine, rating: 1 }), review({ at: nine, rating: 3 })])
    assert.equal(bars.length, 24)
    assert.equal(bars[9].reviews, 2)
    assert.equal(bars[9].correct, 0.5)
    assert.equal(bars[10].correct, null)
  })
})

describe('trueRetention', () => {
  it('counts only the first answer a card gets in a day', () => {
    // Failed, then ground back to Good in the same sitting: still a failure.
    const log = [
      review({ cardId: 'core:a', rating: 1, at: NOW, lastIntervalDays: 30 }),
      review({ cardId: 'core:a', rating: 3, at: NOW + 1000, lastIntervalDays: 30 }),
    ]
    const today = trueRetention(log, NOW + 2000).find((row) => row.label === 'Today')
    assert.equal(today?.matureTotal, 1)
    assert.equal(today?.maturePassed, 0)
  })

  it('leaves learning presses out - retention is about graduated cards', () => {
    const log = [review({ phase: 'new', rating: 1 }), review({ phase: 'learning', rating: 3 })]
    const all = trueRetention(log, NOW).find((row) => row.label === 'All time')
    assert.equal(all?.youngTotal, 0)
    assert.equal(all?.matureTotal, 0)
  })

  it('widens with the range', () => {
    const log = [
      review({ cardId: 'core:a', at: NOW, lastIntervalDays: 3, rating: 3 }),
      review({ cardId: 'core:b', at: NOW - 60 * DAY, lastIntervalDays: 3, rating: 1 }),
    ]
    const rows = trueRetention(log, NOW)
    assert.equal(rows.find((row) => row.label === 'Past week')?.youngTotal, 1)
    assert.equal(rows.find((row) => row.label === 'Past year')?.youngTotal, 2)
    assert.equal(rows.find((row) => row.label === 'Past year')?.youngPassed, 1)
  })
})

describe('formatting', () => {
  it('speaks seconds, minutes and hours', () => {
    assert.equal(formatDuration(9000), '9s')
    assert.equal(formatDuration(5 * 60 * 1000), '5m')
    assert.equal(formatDuration(90 * 60 * 1000), '1.5h')
  })

  it('prints an em dash rather than a made-up zero', () => {
    assert.equal(formatPercent(null), '—')
    assert.equal(formatPercent(0.876), '88%')
  })
})
