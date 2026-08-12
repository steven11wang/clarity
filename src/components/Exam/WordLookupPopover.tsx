import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { BookmarkCheck, BookmarkPlus, X } from 'lucide-react'

import type { WordLookupState } from '../../dictionary/useWordLookup.ts'

type WordLookupPopoverProps = {
  state: WordLookupState
  onClose: () => void
  onToggleSave: () => void
  onRetry: () => void
}

const CARD_WIDTH = 320
const GUTTER = 12

export function WordLookupPopover({
  state,
  onClose,
  onToggleSave,
  onRetry,
}: WordLookupPopoverProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const anchorKey =
    state.phase === 'idle' ? '' : `${state.word}:${state.anchor.x}:${state.anchor.top}`

  useEffect(() => setExpanded(false), [anchorKey])

  // Anchored to the word, flipped above it when the bottom of the window is
  // closer than the card is tall, and always clamped inside the viewport.
  useLayoutEffect(() => {
    if (state.phase === 'idle') {
      setPosition(null)
      return
    }
    const card = cardRef.current
    const height = card?.offsetHeight ?? 180
    const { anchor } = state
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const left = Math.min(
      Math.max(GUTTER, anchor.x - CARD_WIDTH / 2),
      Math.max(GUTTER, viewportWidth - CARD_WIDTH - GUTTER),
    )
    const below = anchor.bottom + GUTTER
    const flip = below + height > viewportHeight - GUTTER && anchor.top - height - GUTTER > GUTTER
    const rawTop = flip ? anchor.top - height - GUTTER : below
    const top = Math.max(GUTTER, Math.min(viewportHeight - height - GUTTER, rawTop))
    setPosition({
      left,
      top,
      width: CARD_WIDTH,
    })
  }, [state, expanded])

  useEffect(() => {
    if (state.phase === 'idle') return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (cardRef.current?.contains(event.target as Node)) return
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mousedown', onPointerDown)
    }
  }, [state.phase, onClose])

  if (state.phase === 'idle') return null

  const saved = state.phase === 'ready' && state.saved

  return (
    <div
      className="exam-lookup"
      role="dialog"
      aria-label={`Definition of ${state.word}`}
      ref={cardRef}
      style={position ?? { left: -9999, top: 0, width: CARD_WIDTH }}
    >
      <div className="exam-lookup__head">
        <div>
          <strong className="exam-lookup__word">{state.word}</strong>
          {state.phase === 'ready' ? (
            <em className="exam-lookup__pos">{state.sense.partOfSpeech}</em>
          ) : null}
        </div>
        <button
          className="exam-lookup__close"
          type="button"
          onClick={onClose}
          aria-label="Close the definition"
        >
          <X size={15} strokeWidth={1.8} />
        </button>
      </div>

      {state.phase === 'loading' ? (
        <p className="exam-lookup__status">Looking it up…</p>
      ) : null}

      {state.phase === 'missing' ? (
        <p className="exam-lookup__status">
          No dictionary entry for this word. It may be a name or a form the dictionary
          does not carry.
        </p>
      ) : null}

      {state.phase === 'error' ? (
        <div className="exam-lookup__status">
          <p>{state.message}</p>
          <button className="exam-lookup__link" type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}

      {state.phase === 'ready' ? (
        <>
          <p className="exam-lookup__definition">{state.sense.definition}</p>

          {expanded && state.alternates.length > 0 ? (
            <ul className="exam-lookup__alternates">
              {state.alternates.map((sense) => (
                <li key={`${sense.partOfSpeech}-${sense.definition}`}>
                  <em>{sense.partOfSpeech}</em> {sense.definition}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="exam-lookup__actions">
            <button
              className={`exam-lookup__save ${saved ? 'exam-lookup__save--on' : ''}`}
              type="button"
              onClick={onToggleSave}
              aria-pressed={saved}
            >
              {saved ? <BookmarkCheck size={15} strokeWidth={1.8} /> : <BookmarkPlus size={15} strokeWidth={1.8} />}
              {saved ? 'Saved to Word Bank' : 'Save to Word Bank'}
            </button>
            {state.alternates.length > 0 ? (
              <button
                className="exam-lookup__link"
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded ? 'Fewer senses' : `${state.alternates.length} more`}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
