import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'

import type { WordDeckContent } from '../../dictionary/wordDecks.ts'
import {
  countDeck,
  deckCards,
  nextCard,
  type DeckReview,
} from '../../review/deckQueue.ts'
import {
  RATINGS,
  RATING_LABELS,
  answerCard,
  formatDelay,
  previewDelays,
  type Rating,
} from '../../review/deckScheduler.ts'
import {
  appendDeckReview,
  getDeckCards,
  getDeckReviews,
  now,
  saveDeckCard,
} from '../../storage/index.ts'

// The study run: one card at a time, four buttons, exactly as Anki does it.
//
// There is no fixed queue. A card answered Again is due in a minute and comes
// back before the sitting ends, so the next card is asked for after every press
// rather than dealt out in advance - which is also what makes the counters at
// the top move the way an Anki user expects them to.

type DeckStudyProps = {
  deck: WordDeckContent
  onExit: () => void
}

export function DeckStudy({ deck, onExit }: DeckStudyProps) {
  const [version, setVersion] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [lastAnswered, setLastAnswered] = useState<string | null>(null)
  const [answered, setAnswered] = useState(0)
  const shownAt = useRef(Date.now())

  const cardIds = useMemo(() => deck.cards.map((entry) => entry.id), [deck])

  const snapshot = useMemo(() => {
    void version
    const at = now()
    const cards = deckCards(cardIds, deck.id, getDeckCards())
    const log = getDeckReviews()
    return {
      at,
      cards,
      log,
      counts: countDeck(cards, log, deck.id, at),
      card: nextCard(cards, log, deck.id, at, lastAnswered),
    }
  }, [version, cardIds, deck.id, lastAnswered])

  const card = snapshot.card
  const content = useMemo(
    () => (card ? deck.cards.find((entry) => entry.id === card.id) ?? null : null),
    [card, deck],
  )

  // A fresh card starts its own clock: the log records how long each answer
  // took, which is the only way the analysis screen can report time studied.
  useEffect(() => {
    shownAt.current = Date.now()
    setRevealed(false)
  }, [card?.id])

  const answer = useCallback(
    (rating: Rating) => {
      if (!card) return
      const at = now()
      const next = answerCard(card, rating, at)
      const entry: DeckReview = {
        cardId: card.id,
        deckId: deck.id,
        at,
        rating,
        phase: card.phase,
        lastIntervalDays: card.intervalDays,
        intervalDays: next.intervalDays,
        ease: next.ease,
        tookMs: Math.min(60_000, Date.now() - shownAt.current),
      }
      saveDeckCard(next)
      appendDeckReview(entry)
      // Reset here rather than only on a change of card: answering Again puts
      // the same card back at the front of the queue, and its id does not move.
      setRevealed(false)
      shownAt.current = Date.now()
      setLastAnswered(card.id)
      setAnswered((count) => count + 1)
      setVersion((value) => value + 1)
    },
    [card, deck.id],
  )

  // Anki's keys, because the muscle memory is the point: space reveals the card
  // and then answers Good, and 1-4 pick a button once the answer is showing.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (!card) return

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        if (revealed) answer(3)
        else setRevealed(true)
        return
      }
      if (!revealed) return
      const rating = Number(event.key)
      if (rating >= 1 && rating <= 4) {
        event.preventDefault()
        answer(rating as Rating)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [card, revealed, answer])

  if (!card || !content) {
    return (
      <section className="deckstudy deckstudy--done" aria-label="Deck finished for now">
        <div className="wordbank__card wordbank__card--done">
          <p className="wordbank__eyebrow">DECK CLEAR</p>
          <h1>
            {answered > 0
              ? `${answered} ${answered === 1 ? 'card' : 'cards'} answered.`
              : 'Nothing waiting.'}
          </h1>
          <p className="wordbank__lede">
            {snapshot.counts.new > 0
              ? `Today’s fifteen new words are in. ${snapshot.counts.new} unseen ${
                  snapshot.counts.new === 1 ? 'card is' : 'cards are'
                } queued for the days ahead, and what you just answered comes back on its own schedule.`
              : 'Every card in this deck is scheduled. Come back when the next one is due.'}
          </p>
          <button className="console-button console-button--primary" type="button" onClick={onExit}>
            Back to the decks
          </button>
        </div>
      </section>
    )
  }

  const delays = previewDelays(card, snapshot.at)

  return (
    <section className="deckstudy" aria-label={`Studying ${deck.title}`}>
      <header className="deckstudy__bar">
        <button className="wordbank__back" type="button" onClick={onExit}>
          <ArrowLeft aria-hidden="true" />
          Leave the deck
        </button>
        <p className="deckstudy__counts" aria-label="Cards waiting">
          {/* Anki's blue count is what today still allows, not the whole
              unseen pile - the pile is on the deck list. */}
          <span className="deckstudy__count deckstudy__count--new">
            {snapshot.counts.newRemaining}
          </span>
          <span className="deckstudy__count deckstudy__count--learning">
            {snapshot.counts.learning}
          </span>
          <span className="deckstudy__count deckstudy__count--due">{snapshot.counts.due}</span>
        </p>
      </header>

      <div className="wordbank__card deckstudy__card">
        <strong className="wordbank__prompt">{content.word}</strong>

        {revealed ? (
          <>
            <hr className="deckstudy__rule" />
            <p className="wordbank__answer">{content.definition}</p>
            <div className="deckstudy__buttons">
              {RATINGS.map((rating) => (
                <button
                  key={rating}
                  className={`deckstudy__button deckstudy__button--${RATING_LABELS[rating].toLowerCase()}`}
                  type="button"
                  onClick={() => answer(rating)}
                >
                  <b>{formatDelay(delays[rating])}</b>
                  <span>{RATING_LABELS[rating]}</span>
                  <small aria-hidden="true">{rating}</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="wordbank__ask">What does it mean?</p>
            <button
              className="console-button console-button--primary"
              type="button"
              onClick={() => setRevealed(true)}
            >
              Show the answer
            </button>
          </>
        )}
      </div>

      <p className="deckstudy__hint">
        Space shows the answer, then answers Good. Keys 1 to 4 pick a button.
      </p>
    </section>
  )
}
