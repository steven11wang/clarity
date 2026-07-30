import { useEffect, useMemo, useRef, useState } from 'react'

import type { Confidence, FirstPass, Question } from '../../types.ts'
import { orderedChoices } from '../../review/ordering.ts'
import { Passage } from '../Passage/Passage.tsx'
import { AbcToggle, ChoiceMarker } from './ChoiceStrikeout.tsx'
import { toggleChoiceStrikeout } from './model.ts'

const CONFIDENCE: { id: Confidence; label: string }[] = [
  { id: 'sure', label: 'Sure' },
  { id: 'leaning', label: 'Leaning' },
  { id: 'guessing', label: 'Guessing' },
]

function formatClock(seconds: number): string {
  const s = Math.ceil(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

type Props = {
  question: Question
  isReview: boolean
  timedMode: boolean
  timeLimitSec: number
  onAnswer: (firstPass: FirstPass) => void
}

// The answer pass: read, pick, commit a confidence — no reveal, no diagnosis.
// The whole set is answered this way before any review begins.
export function AnswerPass({ question, isReview, timedMode, timeLimitSec, onAnswer }: Props) {
  const [choice, setChoice] = useState<string | null>(null)
  const [struckChoices, setStruckChoices] = useState<string[]>([])
  const [abcMode, setAbcMode] = useState(false)
  const [confidence, setConfidence] = useState<Confidence | null>(null)
  const [timedOut, setTimedOut] = useState(false)

  const startRef = useRef(Date.now())
  const firedRef = useRef(false)
  const [remaining, setRemaining] = useState(timeLimitSec)

  const choiceSlots = useMemo(() => orderedChoices(question, isReview), [question, isReview])

  function commit() {
    if (!choice || !confidence || firedRef.current) return
    firedRef.current = true
    onAnswer({
      chosen: choice,
      confidence,
      correct: choice === question.answer,
      timeMs: timedMode ? Date.now() - startRef.current : null,
      timedOut: false,
    })
  }

  function handleTimeout() {
    if (firedRef.current) return
    firedRef.current = true
    setTimedOut(true)
  }

  useEffect(() => {
    if (!timedMode) return
    const id = setInterval(() => {
      const left = Math.max(0, timeLimitSec - (Date.now() - startRef.current) / 1000)
      setRemaining(left)
      if (left <= 0) {
        clearInterval(id)
        handleTimeout()
      }
    }, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedMode, timeLimitSec])

  useEffect(() => {
    if (!timedOut) return
    const id = setTimeout(
      () =>
        onAnswer({
          chosen: choice ?? '',
          confidence,
          correct: false,
          timeMs: timeLimitSec * 1000,
          timedOut: true,
        }),
      1800,
    )
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOut])

  if (timedOut) {
    return (
      <>
        <Passage question={question} />
        <section className="question-panel">
          <div className="step done">
            <p className="done-headline">⏱ Time&rsquo;s up — moved on.</p>
            <ul className="done-facts">
              <li>You&rsquo;ll get this one back in the review — untimed — so you can actually work it.</li>
            </ul>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <Passage question={question} />
      <section className="question-panel">
        {timedMode && (
          <div className={`timer ${remaining <= 15 ? 'timer--urgent' : ''}`} role="timer" aria-label="Time remaining">
            <div className="timer-bar">
              <div className="timer-fill" style={{ width: `${(remaining / timeLimitSec) * 100}%` }} />
            </div>
            <span className="timer-label">{formatClock(remaining)}</span>
          </div>
        )}

        <div className="question-heading">
          <h1 className="question-prompt">{question.prompt}</h1>
          <AbcToggle active={abcMode} onToggle={() => setAbcMode((active) => !active)} />
        </div>

        <div className="choice-list" role="radiogroup" aria-label="Answer choices">
          {choiceSlots.map((slot) => {
            const struck = struckChoices.includes(slot.sourceLetter)
            return (
              <div
                key={slot.displayLetter}
                className={`choice ${choice === slot.sourceLetter ? 'choice--selected' : ''} ${struck ? 'choice--struck' : ''}`}
              >
                <button
                  type="button"
                  className="choice-select"
                  onClick={() => setChoice(slot.sourceLetter)}
                >
                  <span className="choice-text">{slot.text}</span>
                </button>
                {abcMode && (
                  <ChoiceMarker
                    letter={slot.displayLetter}
                    struck={struck}
                    onToggle={() => setStruckChoices((current) => toggleChoiceStrikeout(current, slot.sourceLetter))}
                  />
                )}
              </div>
            )
          })}
        </div>

        <div className="confidence">
          <p className="panel-label">How sure are you? <span>(required)</span></p>
          <div className="confidence-row">
            {CONFIDENCE.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`pill ${confidence === c.id ? 'pill--on' : ''}`}
                onClick={() => setConfidence(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button type="button" className="button button--full" disabled={!choice || !confidence} onClick={commit}>
            Continue
          </button>
        </div>
      </section>
    </>
  )
}
