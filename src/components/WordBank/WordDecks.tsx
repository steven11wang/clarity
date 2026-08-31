import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BarChart3, Lock, RotateCcw } from 'lucide-react'

import {
  DECK_BLURBS,
  CORE_DECK_ID,
  isDeckUnlocked,
  loadWordDecks,
  unlockProgress,
  type WordDeckContent,
} from '../../dictionary/wordDecks.ts'
import { countDeck, deckCards, type DeckCounts } from '../../review/deckQueue.ts'
import { DECK_CONFIG } from '../../review/deckScheduler.ts'
import { formatDueIn } from '../../review/vault.ts'
import {
  getDeckCards,
  getDeckReviews,
  now,
  resetDeck,
  subscribeStorageChanges,
} from '../../storage/index.ts'
import { DeckStats } from './DeckStats.tsx'
import { DeckStudy } from './DeckStudy.tsx'

// The learning decks: four hundred and twenty words shipped with the app, run
// on Anki's scheduler rather than on the saved-word ladder next door. Deck two
// is behind deck one on purpose - sixty rare words are worth nothing until the
// three hundred and sixty common ones are in.

type View =
  | { name: 'list' }
  | { name: 'study'; deckId: string }
  | { name: 'stats' }

type WordDecksProps = {
  /** The Words tab switcher, rendered above the deck list but not over a card. */
  tabs?: ReactNode
}

export function WordDecks({ tabs }: WordDecksProps) {
  const [decks, setDecks] = useState<WordDeckContent[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState<View>({ name: 'list' })
  const [version, setVersion] = useState(0)
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    loadWordDecks()
      .then((loaded) => {
        if (live) setDecks(loaded)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => subscribeStorageChanges(() => setVersion((value) => value + 1)), [])

  const state = useMemo(() => {
    void version
    if (decks === null) return null
    const at = now()
    const saved = getDeckCards()
    const log = getDeckReviews()
    const core = decks.find((deck) => deck.id === CORE_DECK_ID)
    const coreCards = core
      ? deckCards(
          core.cards.map((entry) => entry.id),
          core.id,
          saved,
        )
      : []
    return {
      at,
      rows: decks.map((deck) => {
        const cards = deckCards(
          deck.cards.map((entry) => entry.id),
          deck.id,
          saved,
        )
        const scheduled = cards
          .filter((card) => card.phase !== 'new' && card.dueAt > at)
          .sort((a, b) => a.dueAt - b.dueAt)
        return {
          deck,
          counts: countDeck(cards, log, deck.id, at),
          unlocked: isDeckUnlocked(deck.id, coreCards),
          gate: unlockProgress(coreCards),
          nextDueAt: scheduled[0]?.dueAt ?? null,
        }
      }),
    }
  }, [decks, version])

  if (failed) {
    return (
      <section className="wordbank" aria-label="Learning decks">
        {tabs}
        <p className="wordbank__empty">
          The word decks could not be loaded. Check the connection and reopen this tab.
        </p>
      </section>
    )
  }

  if (decks === null || state === null) {
    return (
      <section className="wordbank" aria-label="Learning decks">
        {tabs}
        <p className="wordbank__empty">Loading the decks…</p>
      </section>
    )
  }

  if (view.name === 'stats') {
    return <DeckStats decks={decks} onBack={() => setView({ name: 'list' })} />
  }

  if (view.name === 'study') {
    const deck = decks.find((entry) => entry.id === view.deckId)
    if (deck) return <DeckStudy deck={deck} onExit={() => setView({ name: 'list' })} />
  }

  return (
    <section className="wordbank worddecks" aria-label="Learning decks">
      {tabs}
      <header className="worddecks__head">
        <p className="wordbank__eyebrow">LEARNING WORDS</p>
        <h1>Four hundred and twenty<br />words, on a schedule.</h1>
        <p className="wordbank__lede">
          Two decks, run on Anki’s algorithm: {DECK_CONFIG.newPerDay} new words a day, four buttons
          on the back of every card, and a gap that widens each time you get one right and collapses
          when you don’t. Nothing here is a list to reread - each word comes back exactly when you
          are about to lose it.
        </p>
        <div className="wordbank__actions">
          <button
            className="console-button console-button--secondary"
            type="button"
            onClick={() => setView({ name: 'stats' })}
          >
            <BarChart3 size={15} strokeWidth={1.7} absoluteStrokeWidth aria-hidden="true" />
            Analysis
          </button>
        </div>
      </header>

      <ol className="worddecks__list">
        {state.rows.map(({ deck, counts, unlocked, gate, nextDueAt }) => (
          <li className={`worddecks__deck${unlocked ? '' : ' worddecks__deck--locked'}`} key={deck.id}>
            <div className="worddecks__copy">
              <p className="wordbank__eyebrow">
                {DECK_BLURBS[deck.id]?.kicker ?? 'DECK'}
                {unlocked ? null : (
                  <>
                    {' · '}
                    <Lock size={12} strokeWidth={2} absoluteStrokeWidth aria-hidden="true" /> LOCKED
                  </>
                )}
              </p>
              <h2>{deck.title}</h2>
              <p className="worddecks__blurb">{DECK_BLURBS[deck.id]?.blurb}</p>

              {unlocked ? (
                <DeckMeter counts={counts} />
              ) : (
                <p className="worddecks__gate">
                  Opens once every word in the first deck has been learned once —{' '}
                  <b>
                    {gate.done} of {gate.total}
                  </b>{' '}
                  so far.
                </p>
              )}
            </div>

            <div className="worddecks__side">
              {/* A locked deck has no queue to report - showing one would
                  promise fifteen words a day that cannot be studied. */}
              <dl className="worddecks__counts">
                {unlocked ? (
                  <>
                    <div className="worddecks__count--new">
                      <dt>{counts.newRemaining}</dt>
                      <dd>NEW TODAY</dd>
                    </div>
                    <div className="worddecks__count--learning">
                      <dt>{counts.learning}</dt>
                      <dd>LEARNING</dd>
                    </div>
                    <div className="worddecks__count--due">
                      <dt>{counts.due}</dt>
                      <dd>DUE</dd>
                    </div>
                  </>
                ) : (
                  <div>
                    <dt>{counts.total}</dt>
                    <dd>WORDS WAITING</dd>
                  </div>
                )}
              </dl>

              <button
                className="console-button console-button--primary"
                type="button"
                disabled={!unlocked || counts.readyNow === 0}
                onClick={() => setView({ name: 'study', deckId: deck.id })}
              >
                {!unlocked
                  ? 'Finish deck one first'
                  : counts.readyNow > 0
                    ? `Study (${counts.readyNow})`
                    : nextDueAt === null
                      ? 'Nothing left today'
                      : `Next card ${formatDueIn(nextDueAt - state.at)}`}
              </button>

              {confirming === deck.id ? (
                <p className="worddecks__confirm">
                  Erase every schedule in this deck?
                  <button
                    type="button"
                    onClick={() => {
                      resetDeck(deck.id)
                      setConfirming(null)
                      setVersion((value) => value + 1)
                    }}
                  >
                    Reset
                  </button>
                  <button type="button" onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                </p>
              ) : counts.total > counts.new ? (
                <button
                  className="worddecks__reset"
                  type="button"
                  onClick={() => setConfirming(deck.id)}
                >
                  <RotateCcw size={13} strokeWidth={1.7} absoluteStrokeWidth aria-hidden="true" />
                  Reset deck
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** How much of the deck has been met at all, and how much of it has settled. */
function DeckMeter({ counts }: { counts: DeckCounts }) {
  const met = counts.total - counts.new
  const share = counts.total === 0 ? 0 : met / counts.total
  return (
    <div className="worddecks__meter">
      <span className="worddecks__meter-track">
        <span className="worddecks__meter-fill" style={{ width: `${share * 100}%` }} />
      </span>
      <small>
        {met} of {counts.total} met · {counts.graduated} learned
      </small>
    </div>
  )
}
