import { assetPath } from '../lib/assetPath.ts'
import type { DeckCard } from '../review/deckScheduler.ts'

// The two learning decks: four hundred and twenty words that turn up on the
// test, shipped with the app rather than gathered from passages.
//
// The catalogue is data - word and definition, built from the source Anki decks
// by tools/build_word_decks.py. The review state that rides on top of it lives
// per learner in storage, keyed by the card ids here.

export type DeckCardContent = {
  id: string
  word: string
  definition: string
}

export type WordDeckContent = {
  id: string
  title: string
  cards: DeckCardContent[]
}

type DeckFile = {
  version: number
  decks: WordDeckContent[]
}

export const WORD_DECKS_PATH = assetPath('/data/word-decks.json')

export const CORE_DECK_ID = 'core'
export const LONGSHOT_DECK_ID = 'longshot'

/** Copy for each deck. Kept beside the unlock rule, since the two explain each other. */
export const DECK_BLURBS: Record<string, { kicker: string; blurb: string }> = {
  [CORE_DECK_ID]: {
    kicker: 'DECK ONE',
    blurb:
      'The words the test actually leans on. Three hundred and sixty of them, ' +
      'fifteen new a day, on the same algorithm Anki uses - the gap between ' +
      'sightings widens every time you get one right and collapses when you don’t.',
  },
  [LONGSHOT_DECK_ID]: {
    kicker: 'DECK TWO',
    blurb:
      'Sixty words that rarely show up - but when one does, nothing else in the ' +
      'sentence will save you. Worth knowing once the first deck is behind you, ' +
      'and not a minute before.',
  },
}

let filePromise: Promise<DeckFile> | null = null

/**
 * Fetch (once) the deck catalogue. A failed fetch clears the cache so a later
 * attempt retries rather than replaying the rejection - the same shape the
 * lesson pages use.
 */
export function loadWordDecks(): Promise<WordDeckContent[]> {
  if (filePromise === null) {
    filePromise = fetch(WORD_DECKS_PATH)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load the word decks')
        return response.json() as Promise<DeckFile>
      })
      .catch((error) => {
        filePromise = null
        throw error
      })
  }
  return filePromise.then((file) => file.decks)
}

/** Test seam: drop the memoized fetch so the next call goes out again. */
export function resetWordDeckCache(): void {
  filePromise = null
}

/**
 * Deck one is finished when every one of its cards has graduated out of
 * learning at least once - you have met all three hundred and sixty and got
 * each of them right at least once without help.
 *
 * Deliberately a one-way gate: it looks at whether a card has *ever* graduated,
 * not where it sits today. A lapse in month three must not lock deck two again.
 */
export function isDeckFinished(cards: DeckCard[]): boolean {
  return cards.length > 0 && cards.every((card) => card.graduatedAt !== null)
}

/** How far along the unlock is, for the progress line on the locked deck. */
export function unlockProgress(cards: DeckCard[]): { done: number; total: number } {
  return {
    done: cards.filter((card) => card.graduatedAt !== null).length,
    total: cards.length,
  }
}

/**
 * Deck two is available only once deck one is done. Deck one is always open.
 * An unknown deck id is treated as open, so adding a third deck later does not
 * silently hide it.
 */
export function isDeckUnlocked(deckId: string, coreCards: DeckCard[]): boolean {
  if (deckId !== LONGSHOT_DECK_ID) return true
  return isDeckFinished(coreCards)
}
