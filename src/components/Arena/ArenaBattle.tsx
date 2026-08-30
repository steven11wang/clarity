import { useEffect, useMemo, useRef, useState } from 'react'

import { QUESTION_TIME_MS } from '../../arena/config.ts'
import type { SideState } from '../../arena/model.ts'
import { orderedChoices, type ChoiceLetter } from '../../review/ordering.ts'
import type { Question } from '../../types.ts'
import { Passage } from '../Passage/Passage.tsx'
import { EnergyBar, FighterAvatar } from './ArenaMarks.tsx'

function pointShare(mine: number, theirs: number): number {
  const total = mine + theirs
  return total <= 0 ? 0.5 : mine / total
}

export function ArenaBattle({
  question,
  index,
  total,
  seed,
  mine,
  theirs,
  myName,
  myAvatarId,
  rivalName,
  rivalAvatarId,
  onAnswer,
  onLeave,
}: {
  question: Question
  index: number
  total: number
  seed: string
  mine: SideState
  theirs: SideState
  myName: string
  myAvatarId: string
  rivalName: string
  rivalAvatarId: string
  onAnswer: (choice: ChoiceLetter | null, elapsedMs: number) => void
  onLeave: () => void
}) {
  const [picked, setPicked] = useState<ChoiceLetter | null>(null)
  const [remaining, setRemaining] = useState(QUESTION_TIME_MS)
  const startedAt = useRef(Date.now())
  // One answer per question, whether it came from the button or the clock.
  const locked = useRef(false)
  // The tick sets state every 100ms, so `onAnswer` would be a fresh closure on
  // every frame. Held in a ref, the clock is installed once per question rather
  // than torn down and rebuilt under itself.
  const answerRef = useRef(onAnswer)
  answerRef.current = onAnswer
  // Choices are shuffled off the match seed, so both players see the same board
  // and neither can pattern-match "the answer was C".
  const choices = useMemo(
    () => orderedChoices(question, true, `${seed}:${question.id}`),
    [question, seed],
  )

  useEffect(() => {
    setPicked(null)
    setRemaining(QUESTION_TIME_MS)
    startedAt.current = Date.now()
    locked.current = false
  }, [question.id])

  useEffect(() => {
    const timer = setInterval(() => {
      const left = QUESTION_TIME_MS - (Date.now() - startedAt.current)
      setRemaining(Math.max(0, left))
      if (left <= 0 && !locked.current) {
        locked.current = true
        answerRef.current(null, QUESTION_TIME_MS)
      }
    }, 100)
    return () => clearInterval(timer)
  }, [question.id])

  function lockIn() {
    if (locked.current || !picked) return
    locked.current = true
    answerRef.current(picked, Date.now() - startedAt.current)
  }

  const seconds = Math.ceil(remaining / 1000)
  const urgent = seconds <= 10

  return (
    <section className="arena-shell arena-battle">
      <header className="arena-hud">
        <button className="arena-back arena-back--ghost" type="button" onClick={onLeave}>
          Forfeit
        </button>
        <div className="arena-hud__side arena-hud__side--mine">
          <FighterAvatar avatarId={myAvatarId} name={myName} side="mine" size={44} />
          <div>
            <p>{myName}</p>
            <strong>{mine.points}</strong>
          </div>
        </div>
        <div className="arena-hud__center">
          <p className={`arena-clock ${urgent ? 'arena-clock--urgent' : ''}`}>
            0:{String(seconds).padStart(2, '0')}
          </p>
          <EnergyBar
            share={pointShare(mine.points, theirs.points)}
            minePoints={mine.points}
            rivalPoints={theirs.points}
          />
          <p className="arena-hud__progress">
            Question {index + 1} of {total}
          </p>
        </div>
        <div className="arena-hud__side arena-hud__side--rival">
          <div>
            <p>{rivalName}</p>
            <strong>{theirs.points}</strong>
            <span className="arena-hud__status">
              {theirs.finished
                ? 'Finished'
                : theirs.answered > index
                  ? 'Ahead of you'
                  : theirs.answered === index
                    ? 'Level with you'
                    : 'Still on it'}
            </span>
          </div>
          <FighterAvatar avatarId={rivalAvatarId} name={rivalName} side="rival" size={44} />
        </div>
      </header>

      <div className="arena-board">
        <section className="arena-board__passage">
          <p className="arena-board__meta">
            {question.domain} / {question.skill} / {question.difficulty}
          </p>
          <Passage question={question} />
        </section>
        <section className="arena-board__question">
          <h1>{question.prompt}</h1>
          <ul className="arena-choices">
            {choices.map((choice) => (
              <li key={choice.displayLetter}>
                <button
                  className={`arena-choice ${picked === choice.sourceLetter ? 'arena-choice--picked' : ''}`}
                  type="button"
                  onClick={() => setPicked(choice.sourceLetter)}
                  aria-pressed={picked === choice.sourceLetter}
                  data-ui-sound="true"
                  data-ui-sound-hover="hover"
                  data-ui-sound-click="select"
                >
                  <span className="arena-choice__letter">{choice.displayLetter}</span>
                  <span className="arena-choice__text">{choice.text}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            className="arena-button arena-button--primary arena-lock"
            type="button"
            onClick={lockIn}
            disabled={!picked}
            data-ui-sound="true"
            data-ui-sound-hover="hover"
            data-ui-sound-click="open"
          >
            Lock it in
          </button>
        </section>
      </div>
    </section>
  )
}
