import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  countDeck,
  deckCards,
  newIntroducedToday,
  nextCard,
  readyCards,
  reviewsToday,
  type DeckReview,
} from './deckQueue.ts'
import { DECK_CONFIG, createCard, type CardPhase, type DeckCard } from './deckScheduler.ts'

// Fixed at midday so the 4am day boundary is a long way from either edge.
const NOW = new Date(2026, 7, 30, 12, 0, 0).getTime()
const MINUTE = 60 * 1000
const DAY = 24 * 60 * 60 * 1000

function card(id: string, overrides: Partial<DeckCard> = {}): DeckCard {
  return { ...createCard(id, 'core'), ...overrides }
}

function review(overrides: Partial<DeckReview> = {}): DeckReview {
  return {
    cardId: 'core:a',
    deckId: 'core',
    at: NOW,
    rating: 3,
    phase: 'review' as CardPhase,
    lastIntervalDays: 5,
    intervalDays: 12,
    ease: 2500,
    tookMs: 4000,
    ...overrides,
  }
}

describe('deckCards', () => {
  it('materialises cards the learner has never met', () => {
    const cards = deckCards(['core:a', 'core:b'], 'core', {
      'core:a': card('core:a', { phase: 'review', intervalDays: 4 }),
    })
    assert.equal(cards.length, 2)
    assert.equal(cards[0].phase, 'review')
    assert.equal(cards[1].phase, 'new')
    assert.equal(cards[1].deckId, 'core')
  })
})

describe('today’s counters', () => {
  it('reads the log for this deck and this study day only', () => {
    const log = [
      review({ at: NOW }),
      review({ at: NOW, deckId: 'longshot' }),
      review({ at: NOW - 2 * DAY }),
    ]
    assert.equal(reviewsToday(log, 'core', NOW).length, 1)
  })

  it('counts a new card once, however many times it is answered', () => {
    const log = [
      review({ cardId: 'core:a', phase: 'new' }),
      review({ cardId: 'core:a', phase: 'learning' }),
      review({ cardId: 'core:b', phase: 'new' }),
    ]
    assert.equal(newIntroducedToday(log, 'core', NOW), 2)
  })

  it('keeps a session that runs past midnight on the day it started', () => {
    // 1am belongs to the previous study day; the boundary is 4am.
    const oneAm = new Date(2026, 7, 31, 1, 0, 0).getTime()
    assert.equal(newIntroducedToday([review({ at: oneAm, phase: 'new' })], 'core', NOW), 1)
  })
})

describe('readyCards', () => {
  const cards = [
    card('core:due', { phase: 'review', intervalDays: 5, dueAt: NOW - DAY, graduatedAt: NOW }),
    card('core:later', { phase: 'review', intervalDays: 5, dueAt: NOW + 3 * DAY, graduatedAt: NOW }),
    card('core:learning', { phase: 'learning', step: 1, dueAt: NOW - MINUTE }),
    card('core:new1'),
    card('core:new2'),
  ]

  it('offers due learning cards, due reviews and unseen cards', () => {
    const ids = readyCards(cards, [], 'core', NOW).map((entry) => entry.id)
    assert.deepEqual(ids.sort(), ['core:due', 'core:learning', 'core:new1', 'core:new2'])
  })

  it('holds back new cards once the day’s allowance is spent', () => {
    const log = Array.from({ length: DECK_CONFIG.newPerDay }, (_unused, index) =>
      review({ cardId: `core:seen${index}`, phase: 'new' }),
    )
    const ids = readyCards(cards, log, 'core', NOW).map((entry) => entry.id)
    assert.deepEqual(ids.sort(), ['core:due', 'core:learning'])
  })

  it('stops offering reviews once the day’s review ceiling is hit', () => {
    const log = Array.from({ length: DECK_CONFIG.maxReviewsPerDay }, (_unused, index) =>
      review({ cardId: `core:done${index}` }),
    )
    const ids = readyCards(cards, log, 'core', NOW).map((entry) => entry.id)
    assert.ok(!ids.includes('core:due'))
    assert.ok(ids.includes('core:new1'))
  })

  it('pulls a learning card forward inside the learn-ahead window', () => {
    const soon = [card('core:soon', { phase: 'learning', step: 1, dueAt: NOW + 5 * MINUTE })]
    assert.equal(readyCards(soon, [], 'core', NOW).length, 1)
    const later = [card('core:later', { phase: 'learning', step: 1, dueAt: NOW + 40 * MINUTE })]
    assert.equal(readyCards(later, [], 'core', NOW).length, 0)
  })
})

describe('nextCard', () => {
  it('hands back a learning card that has come due before anything else', () => {
    const cards = [
      card('core:new'),
      card('core:due', { phase: 'review', intervalDays: 5, dueAt: NOW - DAY, graduatedAt: NOW }),
      card('core:learning', { phase: 'learning', step: 1, dueAt: NOW - MINUTE }),
    ]
    assert.equal(nextCard(cards, [], 'core', NOW)?.id, 'core:learning')
  })

  it('mixes unseen cards through the due reviews rather than stacking them', () => {
    const cards = [
      ...Array.from({ length: 4 }, (_unused, index) =>
        card(`core:due${index}`, {
          phase: 'review',
          intervalDays: 5,
          dueAt: NOW - DAY,
          graduatedAt: NOW,
        }),
      ),
      card('core:new1'),
      card('core:new2'),
    ]
    const order = readyCards(cards, [], 'core', NOW)
    assert.equal(order.length, 6)
    // The first card offered is a review, not the head of the new pile.
    assert.equal(nextCard(cards, [], 'core', NOW)?.phase, 'review')
  })

  it('does not hand back the card just answered when another is waiting', () => {
    const cards = [card('core:a'), card('core:b')]
    assert.equal(nextCard(cards, [], 'core', NOW, 'core:a')?.id, 'core:b')
  })

  it('does hand back the only card left, avoid or not', () => {
    const cards = [card('core:a', { phase: 'learning', step: 0, dueAt: NOW })]
    assert.equal(nextCard(cards, [], 'core', NOW, 'core:a')?.id, 'core:a')
  })

  it('returns nothing when the deck is finished for the day', () => {
    const cards = [
      card('core:later', {
        phase: 'review',
        intervalDays: 9,
        dueAt: NOW + 5 * DAY,
        graduatedAt: NOW,
      }),
    ]
    assert.equal(nextCard(cards, [], 'core', NOW), null)
  })
})

describe('countDeck', () => {
  it('sorts the deck into the drawers the deck list shows', () => {
    const cards = [
      card('core:new1'),
      card('core:new2'),
      card('core:learning', { phase: 'learning', dueAt: NOW - MINUTE, introducedAt: NOW }),
      card('core:due', {
        phase: 'review',
        intervalDays: 5,
        dueAt: NOW - DAY,
        graduatedAt: NOW - DAY,
      }),
      card('core:later', {
        phase: 'review',
        intervalDays: 30,
        dueAt: NOW + DAY,
        graduatedAt: NOW - DAY,
      }),
    ]
    const counts = countDeck(cards, [], 'core', NOW)
    assert.equal(counts.new, 2)
    assert.equal(counts.learning, 1)
    assert.equal(counts.due, 1)
    assert.equal(counts.scheduled, 1)
    assert.equal(counts.total, 5)
    assert.equal(counts.graduated, 2)
    assert.equal(counts.newRemaining, 2)
    assert.equal(counts.readyNow, 4)
  })

  it('never reports more new cards remaining than the deck still holds', () => {
    const counts = countDeck([card('core:new1')], [], 'core', NOW)
    assert.equal(counts.newRemaining, 1)
  })
})
