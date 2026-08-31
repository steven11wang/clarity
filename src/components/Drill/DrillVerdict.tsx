import { useEffect, useMemo, useRef } from 'react'
import { ArrowRight, Check, Clock, X } from 'lucide-react'

import { orderedChoices } from '../../review/ordering.ts'
import type { FirstPass, Question } from '../../types.ts'

type DrillVerdictProps = {
  question: Question
  /** Whether the question came back shuffled, so the letters shown match. */
  isReview: boolean
  firstPass: FirstPass
  position: number
  total: number
  correctSoFar: number
  onContinue: () => void
}

// A drill answers back immediately - right or wrong, and which choice was the
// one - and then gets out of the way. The reasoning is deliberately held for
// the review pass at the end of the run: the point of a drill is rhythm, and
// the diagnosis is worth more when the whole set is behind you.
export function DrillVerdict({
  question,
  isReview,
  firstPass,
  position,
  total,
  correctSoFar,
  onContinue,
}: DrillVerdictProps) {
  const continueRef = useRef<HTMLButtonElement>(null)
  const slots = useMemo(() => orderedChoices(question, isReview), [question, isReview])

  useEffect(() => {
    continueRef.current?.focus()
  }, [question.id])

  const letterOf = (sourceLetter: string) =>
    slots.find((slot) => slot.sourceLetter === sourceLetter)?.displayLetter ?? sourceLetter
  const textOf = (sourceLetter: string) =>
    slots.find((slot) => slot.sourceLetter === sourceLetter)?.text ?? ''

  const state = firstPass.timedOut ? 'timeout' : firstPass.correct ? 'correct' : 'missed'
  const last = position === total
  const Mark = state === 'correct' ? Check : state === 'timeout' ? Clock : X

  return (
    <section className={`drill-verdict drill-verdict--${state}`} aria-live="polite">
      <p className="drill-verdict__count">
        Question {position} of {total} · {correctSoFar} right so far
      </p>
      <p className="drill-verdict__prompt">{question.prompt}</p>

      <h2 className="drill-verdict__headline">
        <span className="drill-verdict__mark" aria-hidden="true">
          <Mark size={18} strokeWidth={2} absoluteStrokeWidth />
        </span>
        {state === 'correct' ? 'Correct.' : state === 'timeout' ? 'Time ran out.' : 'Not this one.'}
      </h2>

      <dl className="drill-verdict__answers">
        {state !== 'correct' && firstPass.chosen ? (
          <div className="drill-verdict__answer drill-verdict__answer--yours">
            <dt>You picked</dt>
            <dd>
              <b>{letterOf(firstPass.chosen)}</b>
              {textOf(firstPass.chosen)}
            </dd>
          </div>
        ) : null}
        <div className="drill-verdict__answer drill-verdict__answer--key">
          <dt>{state === 'correct' ? 'Your answer' : 'The answer'}</dt>
          <dd>
            <b>{letterOf(question.answer)}</b>
            {textOf(question.answer)}
          </dd>
        </div>
      </dl>

      <p className="drill-verdict__note">
        {state === 'correct'
          ? 'Filed as clean. Nothing comes back from this one.'
          : state === 'timeout'
            ? 'You get this one back untimed at the end of the drill, and it lands in your mistake vault.'
            : 'You redo and diagnose this one at the end of the drill, and it lands in your mistake vault.'}
      </p>

      <button
        className="drill-verdict__next"
        type="button"
        ref={continueRef}
        onClick={onContinue}
        data-ui-sound="true"
        data-ui-sound-hover="hover"
        data-ui-sound-click="select"
      >
        {last ? 'Finish the drill' : 'Next question'}
        <ArrowRight size={17} strokeWidth={1.7} absoluteStrokeWidth aria-hidden="true" />
      </button>
    </section>
  )
}
