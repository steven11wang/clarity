import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

import { createCard, type DeckCard } from '../review/deckScheduler.ts'
import {
  CORE_DECK_ID,
  DECK_BLURBS,
  LONGSHOT_DECK_ID,
  isDeckFinished,
  isDeckUnlocked,
  unlockProgress,
  type WordDeckContent,
} from './wordDecks.ts'

const NOW = 1_700_000_000_000

function card(id: string, graduatedAt: number | null): DeckCard {
  return { ...createCard(id, 'core'), graduatedAt }
}

describe('the shipped deck file', () => {
  it('carries both decks, with the ids and sizes the app expects', async () => {
    const file = JSON.parse(
      await readFile(new URL('../../public/data/word-decks.json', import.meta.url), 'utf8'),
    ) as { decks: WordDeckContent[] }

    const core = file.decks.find((deck) => deck.id === CORE_DECK_ID)
    const longshot = file.decks.find((deck) => deck.id === LONGSHOT_DECK_ID)
    assert.ok(core, 'the core deck is missing')
    assert.ok(longshot, 'the long-shot deck is missing')
    assert.equal(core.cards.length, 360)
    assert.equal(longshot.cards.length, 60)
    assert.equal(core.title, 'Clarity All-Around Words')
  })

  it('gives every card an id, a word and a definition, and no id twice', async () => {
    const file = JSON.parse(
      await readFile(new URL('../../public/data/word-decks.json', import.meta.url), 'utf8'),
    ) as { decks: WordDeckContent[] }

    const ids = new Set<string>()
    for (const deck of file.decks) {
      for (const entry of deck.cards) {
        assert.ok(entry.word.length > 0, `${entry.id} has no word`)
        assert.ok(entry.definition.length > 0, `${entry.id} has no definition`)
        assert.ok(entry.id.startsWith(`${deck.id}:`), `${entry.id} is filed under ${deck.id}`)
        assert.ok(!ids.has(entry.id), `${entry.id} appears twice`)
        ids.add(entry.id)
      }
    }
    assert.equal(ids.size, 420)
  })

  it('has copy for both decks', () => {
    assert.ok(DECK_BLURBS[CORE_DECK_ID])
    assert.ok(DECK_BLURBS[LONGSHOT_DECK_ID])
  })
})

describe('the deck two gate', () => {
  it('stays shut while any deck one card has never graduated', () => {
    const cards = [card('core:a', NOW), card('core:b', null)]
    assert.equal(isDeckFinished(cards), false)
    assert.equal(isDeckUnlocked(LONGSHOT_DECK_ID, cards), false)
  })

  it('opens once every deck one card has graduated at least once', () => {
    const cards = [card('core:a', NOW), card('core:b', NOW)]
    assert.equal(isDeckFinished(cards), true)
    assert.equal(isDeckUnlocked(LONGSHOT_DECK_ID, cards), true)
  })

  it('stays open after a lapse - graduating is a fact, not a state', () => {
    const lapsed = { ...card('core:a', NOW), phase: 'relearning' as const, lapses: 2 }
    assert.equal(isDeckUnlocked(LONGSHOT_DECK_ID, [lapsed]), true)
  })

  it('never gates deck one on itself', () => {
    assert.equal(isDeckUnlocked(CORE_DECK_ID, [card('core:a', null)]), true)
  })

  it('reports how far along the unlock is', () => {
    const progress = unlockProgress([card('core:a', NOW), card('core:b', null)])
    assert.deepEqual(progress, { done: 1, total: 2 })
  })

  it('treats an empty deck as unfinished rather than finished by default', () => {
    assert.equal(isDeckFinished([]), false)
  })
})
