import { useEffect, useRef, useState } from 'react'

import type { StudyPathStartingStep } from '../../storage/index.ts'
import './studyPathOnboarding.css'

type StudyPathOnboardingProps = {
  onComplete: (startingStep: StudyPathStartingStep) => void
  onDismiss: () => void
}

type Stage = 'history' | 'bluebook' | 'level' | 'plan'

type LevelOption = {
  title: string
  description: string
  startingStep: StudyPathStartingStep
}

// The three self-descriptions map onto the only three useful entry points:
// no foundation yet, foundation but no reps, reps but no score movement.
const LEVEL_OPTIONS: LevelOption[] = [
  {
    title: 'I haven’t really studied yet',
    description: 'Reading & Writing somewhere around 600.',
    startingStep: 1,
  },
  {
    title: 'I studied, but never really practiced',
    description: 'I know the concepts. I haven’t drilled them.',
    startingStep: 2,
  },
  {
    title: 'I’ve practiced, but my score won’t move',
    description: 'I lose points, and I run out of time.',
    startingStep: 5,
  },
]

const PLAN_STEPS = [
  {
    step: 1,
    title: 'Learn the lessons first',
    description:
      'Read every sentence. Look up the words you don’t know. Practice each domain until it reads as Master.',
  },
  {
    step: 2,
    title: 'Find your untimed score',
    description:
      'Same test, no clock. That number is your real ceiling — the timer only takes points away from it.',
  },
  {
    step: 3,
    title: 'Build critical thinking',
    description:
      'Four untimed practice tests. Eliminate every wrong answer out loud before you choose the right one.',
  },
  {
    step: 4,
    title: 'Take one test under real conditions',
    description:
      'Full timing, no pauses. This is a checkpoint to see where you are, not the goal.',
  },
  {
    step: 5,
    title: 'Find out where the points go',
    description:
      'Most students lose points and lose time. That is usually accuracy, not pace.',
  },
  {
    step: 6,
    title: 'Repeat',
    description:
      'Drill the mistake. Redo it. Reflect on why. Then do questions like it.',
  },
] as const

export function StudyPathOnboarding({
  onComplete,
  onDismiss,
}: StudyPathOnboardingProps) {
  const [stage, setStage] = useState<Stage>('history')
  const [startingStep, setStartingStep] = useState<StudyPathStartingStep | null>(
    null,
  )
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [stage])

  function chooseLevel(step: StudyPathStartingStep) {
    setStartingStep(step)
    setStage('plan')
  }

  return (
    <div className="study-path-backdrop">
      <section
        className={`study-path-panel study-path-panel--${stage}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-path-title"
      >
        {stage === 'history' && (
          <>
            <p className="study-path-eyebrow">Set up your path · 1 of 2</p>
            <h1 id="study-path-title" ref={headingRef} tabIndex={-1}>
              How should you start SAT Reading?
            </h1>
            <p className="study-path-lede">
              You can’t fix Reading in three days unless you’re already near
              1550. Answer two questions and Clarity will start you in the right
              place.
            </p>

            <div className="study-path-options">
              <button type="button" onClick={() => setStage('bluebook')}>
                <strong>I haven’t taken a full practice test</strong>
                <small>A plan means nothing without a baseline score.</small>
              </button>
              <button type="button" onClick={() => setStage('level')}>
                <strong>I’ve taken at least one</strong>
                <small>We’ll use it to pick your starting step.</small>
              </button>
            </div>

            <div className="study-path-footer">
              <button
                className="study-path-text-action"
                type="button"
                onClick={onDismiss}
              >
                Skip for now
              </button>
            </div>
          </>
        )}

        {stage === 'bluebook' && (
          <>
            <p className="study-path-eyebrow">First, get a baseline</p>
            <h1 id="study-path-title" ref={headingRef} tabIndex={-1}>
              Take one practice test in Bluebook.
            </h1>
            <p className="study-path-lede">
              Don’t study for it. Take it cold — the point is to see where you
              actually are today. Come back with the score and the rest of the
              path is built around that number.
            </p>

            <div className="study-path-footer study-path-footer--split">
              <button
                className="study-path-text-action"
                type="button"
                onClick={() => setStage('history')}
              >
                Back
              </button>
              <div className="study-path-actions">
                <button
                  className="study-path-text-action"
                  type="button"
                  onClick={onDismiss}
                >
                  I’ll come back after
                </button>
                <a
                  className="study-path-primary-action"
                  href="https://bluebook.collegeboard.org/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Bluebook
                </a>
              </div>
            </div>
          </>
        )}

        {stage === 'level' && (
          <>
            <p className="study-path-eyebrow">Set up your path · 2 of 2</p>
            <h1 id="study-path-title" ref={headingRef} tabIndex={-1}>
              Which one sounds like you?
            </h1>
            <p className="study-path-lede">
              Pick the closest fit. You can change your starting step later.
            </p>

            <div className="study-path-options">
              {LEVEL_OPTIONS.map(({ title, description, startingStep: step }) => (
                <button type="button" onClick={() => chooseLevel(step)} key={step}>
                  <strong>{title}</strong>
                  <small>{description}</small>
                  <em>Starts at step {step}</em>
                </button>
              ))}
            </div>

            <div className="study-path-footer">
              <button
                className="study-path-text-action"
                type="button"
                onClick={() => setStage('history')}
              >
                Back
              </button>
            </div>
          </>
        )}

        {stage === 'plan' && startingStep !== null && (
          <>
            <p className="study-path-eyebrow">Your path</p>
            <h1 id="study-path-title" ref={headingRef} tabIndex={-1}>
              Six steps. You start at step {startingStep}.
            </h1>
            <p className="study-path-lede">
              Steps above yours stay open — go back to them whenever a lesson
              stops making sense.
            </p>

            <ol className="study-path-plan">
              {PLAN_STEPS.map(({ step, title, description }) => (
                <li
                  data-study-path-step={step}
                  data-active={step === startingStep ? 'true' : 'false'}
                  data-earlier={step < startingStep ? 'true' : 'false'}
                  key={step}
                >
                  <span className="study-path-plan__number">{step}</span>
                  <div>
                    <h2>
                      {title}
                      {step === startingStep && <em>You start here</em>}
                    </h2>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="study-path-note">
              Two things carry the whole path: <strong>critical thinking</strong>{' '}
              — read every sentence, eliminate before you choose — and{' '}
              <strong>repetition</strong> — drill, redo, reflect.
            </p>

            <div className="study-path-footer study-path-footer--split">
              <button
                className="study-path-text-action"
                type="button"
                onClick={() => setStage('level')}
              >
                Change answer
              </button>
              <button
                className="study-path-primary-action"
                type="button"
                onClick={() => onComplete(startingStep)}
              >
                Start at step {startingStep}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
