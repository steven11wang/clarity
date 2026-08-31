import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Timer } from 'lucide-react'

import {
  ALL_SKILLS,
  ANY_DIFFICULTY,
  DRILL_CLOCKS,
  DRILL_COUNTS,
  MIXED_DOMAIN,
  drillPool,
  drillSkills,
  selectDrillQuestions,
  withDomain,
  type DrillDomain,
  type DrillSetup,
} from '../../drill/setup.ts'
import { DIFFICULTIES, DOMAIN_PRESENTATION, SAT_DOMAINS } from '../../progression/config.ts'
import type { Question } from '../../types.ts'
import './drill.css'

type DrillPanelProps = {
  questions: Question[]
  /** questionId -> last attempt timestamp, so a repeat drill moves on. */
  seen: Record<string, number>
  setup: DrillSetup
  onChangeSetup: (setup: DrillSetup) => void
  onStart: (setup: DrillSetup, questions: Question[]) => void
  onBack: () => void
  onOpenVault: () => void
  vaultOpenCount: number
}

type Choice<T> = {
  value: T
  label: string
}

// One selectable group, keyboard-complete: the arrow keys walk the options and
// only the current one is in the tab order, which is what a radio group owes a
// keyboard user.
function ChoiceGroup<T extends string | number | null>({
  label,
  hint,
  choices,
  value,
  onChange,
  columns,
}: {
  label: string
  hint?: ReactNode
  choices: Array<Choice<T>>
  value: T
  onChange: (value: T) => void
  columns?: boolean
}) {
  const activeIndex = Math.max(0, choices.findIndex((choice) => choice.value === value))

  function move(from: number, step: number) {
    const next = (from + step + choices.length) % choices.length
    onChange(choices[next].value)
    const group = document.querySelectorAll<HTMLButtonElement>(
      `[data-drill-group="${label}"] button`,
    )
    group[next]?.focus()
  }

  return (
    <div className="drill-group">
      <p className="drill-group__label">{label}</p>
      <div
        className={`drill-options ${columns ? 'drill-options--rows' : ''}`}
        role="radiogroup"
        aria-label={label}
        data-drill-group={label}
      >
        {choices.map((choice, index) => {
          const selected = choice.value === value
          return (
            <button
              key={String(choice.value)}
              className={`drill-option ${selected ? 'drill-option--on' : ''}`}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => onChange(choice.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                  event.preventDefault()
                  move(index, 1)
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  move(index, -1)
                }
              }}
              data-ui-sound="true"
              data-ui-sound-hover="hover"
              data-ui-sound-click="select"
            >
              <span>{choice.label}</span>
            </button>
          )
        })}
      </div>
      {hint ? <p className="drill-group__hint">{hint}</p> : null}
    </div>
  )
}

function estimate(count: number, secondsPerQuestion: number | null): string {
  if (secondsPerQuestion === null) return 'no clock'
  const minutes = Math.round((count * secondsPerQuestion) / 60)
  return minutes < 1 ? 'under a minute' : `about ${minutes} min`
}

export function DrillPanel({
  questions,
  seen,
  setup,
  onChangeSetup,
  onStart,
  onBack,
  onOpenVault,
  vaultOpenCount,
}: DrillPanelProps) {
  // A repeated drill on the same target reshuffles rather than replaying.
  const [seed, setSeed] = useState(0)

  const skills = useMemo(() => drillSkills(questions, setup.domain), [questions, setup.domain])
  const pool = useMemo(() => drillPool(questions, setup), [questions, setup])
  const served = Math.min(setup.count, pool.length)
  const short = pool.length > 0 && pool.length < setup.count

  function start() {
    if (pool.length === 0) return
    setSeed((value) => value + 1)
    onStart(setup, selectDrillQuestions(questions, setup, { seen, seed }))
  }

  return (
    <section className="drill" aria-label="Drills">
      <header className="drill__head">
        <button
          className="drill__back"
          type="button"
          onClick={onBack}
          data-ui-sound="true"
          data-ui-sound-hover="hover"
          data-ui-sound-click="open"
        >
          <ArrowLeft size={16} strokeWidth={1.7} absoluteStrokeWidth aria-hidden="true" />
          Practice
        </button>
        <h1>Build a drill.</h1>
        <p>
          Name the target, set the length, set the clock. You see right or wrong after
          every question, then work the misses at the end - and each one files into your
          mistake vault to come back on a widening schedule.
        </p>
      </header>

      <div className="drill__body">
        <div className="drill__target">
          <ChoiceGroup<DrillDomain>
            label="Domain"
            columns
            value={setup.domain}
            onChange={(domain) => onChangeSetup(withDomain(setup, domain))}
            choices={[
              { value: MIXED_DOMAIN, label: 'Every domain' },
              ...SAT_DOMAINS.map((domain) => ({
                value: domain as DrillDomain,
                label: DOMAIN_PRESENTATION[domain].shortName,
              })),
            ]}
          />

          {setup.domain !== MIXED_DOMAIN && skills.length > 0 ? (
            <ChoiceGroup<string>
              label="Skill"
              value={setup.skill}
              onChange={(skill) => onChangeSetup({ ...setup, skill })}
              choices={[
                { value: ALL_SKILLS, label: 'Every skill' },
                ...skills.map((skill) => ({ value: skill, label: skill })),
              ]}
            />
          ) : null}

          <ChoiceGroup<string>
            label="Difficulty"
            value={setup.difficulty}
            onChange={(difficulty) =>
              onChangeSetup({ ...setup, difficulty: difficulty as DrillSetup['difficulty'] })
            }
            choices={[
              { value: ANY_DIFFICULTY, label: 'Any' },
              ...DIFFICULTIES.map((difficulty) => ({
                value: difficulty as string,
                label: difficulty,
              })),
            ]}
          />
        </div>

        <div className="drill__run">
          <ChoiceGroup<number>
            label="Questions"
            value={setup.count}
            onChange={(count) => onChangeSetup({ ...setup, count })}
            choices={DRILL_COUNTS.map((count) => ({ value: count, label: String(count) }))}
          />

          <ChoiceGroup<number | null>
            label="Time per question"
            hint={
              setup.secondsPerQuestion === null
                ? 'Take as long as you need on each one.'
                : 'Run out and the question moves on - you get it back, untimed, in the review.'
            }
            value={setup.secondsPerQuestion}
            onChange={(secondsPerQuestion) => onChangeSetup({ ...setup, secondsPerQuestion })}
            choices={[
              ...DRILL_CLOCKS.map((seconds) => ({ value: seconds as number | null, label: `${seconds}s` })),
              { value: null, label: 'Untimed' },
            ]}
          />

          <div className="drill__readout">
            <p className="drill__readout-line">
              <strong key={served}>{served}</strong>
              <span>
                {served === 1 ? 'question' : 'questions'} ready
                <b>
                  <Timer size={13} strokeWidth={1.6} absoluteStrokeWidth aria-hidden="true" />
                  {estimate(served, setup.secondsPerQuestion)}
                </b>
              </span>
            </p>
            {pool.length === 0 ? (
              <p className="drill__warn">
                Nothing in the bank matches that target yet. Widen the difficulty, or pick
                another skill.
              </p>
            ) : short ? (
              <p className="drill__warn">
                That target is thin right now, so this drill runs short.
              </p>
            ) : null}
            <button
              className="drill__start"
              type="button"
              disabled={pool.length === 0}
              onClick={start}
              data-ui-sound="true"
              data-ui-sound-hover="hover"
              data-ui-sound-click="open"
            >
              Start the drill
              <ArrowRight size={17} strokeWidth={1.7} absoluteStrokeWidth aria-hidden="true" />
            </button>
            <button className="drill__vault" type="button" onClick={onOpenVault}>
              {vaultOpenCount > 0
                ? `${vaultOpenCount} ${vaultOpenCount === 1 ? 'miss is' : 'misses are'} open in your vault`
                : 'Open your mistake vault'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
