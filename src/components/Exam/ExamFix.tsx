import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

import { LookupText } from '../../dictionary/LookupText.tsx'
import { useWordLookup } from '../../dictionary/useWordLookup.ts'
import { ExamPassage } from './ExamPassage.tsx'
import { ExamExplanation } from './ExamExplanation.tsx'
import { ExamFigure } from './ExamFigure.tsx'
import { ExamTable } from './ExamTable.tsx'
import { WordLookupPopover } from './WordLookupPopover.tsx'
import type { ExamModule, ExamQuestion } from './examData.ts'
import type { ChoiceLetter } from '../../review/ordering.ts'
import { DictionaryToggle } from '../QuestionInteraction/ChoiceStrikeout.tsx'
import {
  CAUSES,
  WRONG_REASONS,
  setCause,
  setContrast,
  submitRedo,
  toggleChoiceStrikeout,
  type LoopState,
} from '../QuestionInteraction/model.ts'

export type FixEntry = {
  module: ExamModule
  question: ExamQuestion
  chosen: string | undefined
}

/**
 * The same review loop the mini quiz runs, wired to a finished practice exam:
 * redo the question until you find the key yourself, then read the breakdown
 * against your own answer, then name why you missed it. The report keeps the
 * key hidden until every miss has been through this.
 */
function initFix(entry: FixEntry): LoopState {
  return {
    phase: 'redo',
    reviewStage: 0,
    answer: (entry.question.answer ?? 'A') as ChoiceLetter,
    firstChoice: entry.chosen ?? '',
    confidence: null,
    correct: false,
    pass1TimeMs: null,
    // No answer committed on the exam is the same situation as running out the
    // clock in the quiz: nothing to contrast, so the copy changes.
    pass1TimedOut: entry.chosen === undefined,
    pass1StruckChoices: [],
    attempts: 0,
    wrongChoices: [],
    errorCause: null,
    whyWrong: '',
  }
}

export function ExamFix({
  entries,
  fixed,
  onFixed,
  onSkipAll,
}: {
  entries: FixEntry[]
  fixed: Record<string, boolean>
  onFixed: (questionId: string) => void
  onSkipAll?: () => void
}) {
  const remaining = entries.filter((entry) => !fixed[entry.question.id])
  const entry = remaining[0]
  const done = entries.length - remaining.length

  const [state, setState] = useState<LoopState | null>(() =>
    entry ? initFix(entry) : null,
  )
  const [reason, setReason] = useState('')
  const [struck, setStruck] = useState<string[]>([])
  const [crossOutMode, setCrossOutMode] = useState(false)
  const [dictionary, setDictionary] = useState(false)

  const wordLookup = useWordLookup()

  const currentId = entry?.question.id
  useEffect(() => {
    if (!entry) return
    setState(initFix(entry))
    setReason('')
    setStruck([])
    setCrossOutMode(false)
    wordLookup.close()
    // Re-arming on the question id keeps a re-render from resetting a loop in
    // progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  function step(advance: (current: LoopState) => LoopState) {
    setState((current) => (current ? advance(current) : current))
  }

  if (!entry || !state) return null

  const { module, question, chosen } = entry

  return (
    <section className="exam-fix">
      <header className="exam-fix__head">
        <div>
          <p className="exam-fix__eyebrow">
            Fix your misses · {done} of {entries.length} cleared
            {onSkipAll ? (
              <button
                className="exam-button exam-button--ghost exam-button--small"
                type="button"
                style={{ marginLeft: '12px' }}
                onClick={onSkipAll}
              >
                Unlock full review
              </button>
            ) : null}
          </p>
          <h2>
            {module.label} · Question {question.number}
          </h2>
        </div>
        <div className="exam-fix__progress" aria-hidden="true">
          {entries.map((item) => (
            <span
              className={[
                'exam-fix__pip',
                fixed[item.question.id] ? 'exam-fix__pip--done' : '',
                item.question.id === question.id ? 'exam-fix__pip--current' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={item.question.id}
            />
          ))}
        </div>
      </header>

      {question.figure ? <ExamFigure figure={question.figure} /> : null}
      {question.table ? <ExamTable table={question.table} /> : null}

      <ExamPassage
        paragraphs={question.passage}
        highlights={[]}
        annotate={false}
        onHighlightChange={() => {}}
        dictionary={dictionary}
        onLookup={(req) =>
          wordLookup.open({ ...req, source: { examId: module.id, questionId: question.id } })
        }
      />

      <p className="exam-stem">
        <LookupText
          text={question.stem}
          dictionary={dictionary}
          onLookup={(req) =>
            wordLookup.open({ ...req, source: { examId: module.id, questionId: question.id } })
          }
        />
      </p>

      {state.phase === 'redo' ? (
        <>
          <p className="exam-fix__label">
            {state.pass1TimedOut
              ? 'You left this one blank on the exam. Work it through now, no clock.'
              : 'You missed this one. Your answer is marked below — redo it and find the key yourself before the breakdown.'}
          </p>
          <div className="exam-fix__tools">
            <DictionaryToggle active={dictionary} onToggle={() => setDictionary((d) => !d)} />
            <button
              className={`exam-abc ${crossOutMode ? 'exam-abc--on' : ''}`}
              type="button"
              aria-pressed={crossOutMode}
              aria-label="Toggle answer cross-out tool"
              onClick={() => setCrossOutMode((on) => !on)}
            >
              ABC
            </button>
          </div>
          <ul className="exam-choices">
            {question.choices.map((choice) => {
              const wasFirstPick = chosen !== undefined && chosen === choice.letter
              const clickedWrong = state.wrongChoices.includes(choice.letter)
              const isWrong = wasFirstPick || clickedWrong
              const isStruck = struck.includes(choice.letter)
              return (
                <li key={choice.letter}>
                  <button
                    className={[
                      'exam-choice',
                      isWrong ? 'exam-choice--miss' : '',
                      isStruck ? 'exam-choice--struck' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    type="button"
                    disabled={isWrong}
                    aria-label={
                      wasFirstPick
                        ? `Choice ${choice.letter}: the answer you chose on the exam, incorrect`
                        : clickedWrong
                          ? `Choice ${choice.letter}: incorrect`
                          : undefined
                    }
                    onClick={() => step((current) => submitRedo(current, choice.letter))}
                  >
                    <span className="exam-choice__letter">{choice.letter}</span>
                    <span className="exam-choice__text">
                      <LookupText
                        text={choice.text}
                        dictionary={dictionary}
                        onLookup={(req) =>
                          wordLookup.open({ ...req, source: { examId: module.id, questionId: question.id } })
                        }
                      />
                    </span>
                    {wasFirstPick ? (
                      <span className="exam-choice__tag">You chose this</span>
                    ) : clickedWrong ? (
                      <span className="exam-choice__tag">Incorrect</span>
                    ) : null}
                  </button>
                  {crossOutMode && !isWrong ? (
                    <button
                      className={`exam-strike ${isStruck ? 'exam-strike--on' : ''}`}
                      type="button"
                      onClick={() => setStruck((current) => toggleChoiceStrikeout(current, choice.letter))}
                      aria-label={
                        isStruck
                          ? `Undo cross out for choice ${choice.letter}`
                          : `Cross out choice ${choice.letter}`
                      }
                    >
                      {isStruck ? 'Undo' : choice.letter}
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {state.wrongChoices.length > 0 ? (
            <p className="exam-fix__nudge">
              Not that one — try again. Every option you rule out here is one that
              can’t catch you on test day.
            </p>
          ) : null}
        </>
      ) : null}

      {state.phase === 'contrast' ? (
        <div className="exam-fix__step">
          <p className="exam-fix__label">
            {state.pass1TimedOut
              ? 'You found it. Here is the breakdown.'
              : 'You found it. Now put the two side by side.'}
          </p>
          <ExamExplanation
            question={question}
            chosen={chosen}
            dictionary={dictionary}
            onLookup={(req) =>
              wordLookup.open({ ...req, source: { examId: module.id, questionId: question.id } })
            }
          />
          {state.pass1TimedOut ? (
            <button
              className="exam-button exam-button--primary"
              type="button"
              onClick={() => step((current) => setContrast(current, 'I left it blank'))}
            >
              Continue
            </button>
          ) : (
            <>
              <p className="exam-fix__label">Why was your answer wrong?</p>
              <select
                className="exam-fix__select"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-label="Why your answer was wrong"
              >
                <option value="" disabled>
                  Choose a reason…
                </option>
                {WRONG_REASONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                className="exam-button exam-button--primary"
                type="button"
                disabled={!reason}
                onClick={() => step((current) => setContrast(current, reason))}
              >
                Continue
              </button>
            </>
          )}
        </div>
      ) : null}

      {state.phase === 'cause' ? (
        <div className="exam-fix__step">
          <p className="exam-fix__label">
            Last thing — why did you miss it the first time?
          </p>
          <div className="exam-fix__causes">
            {CAUSES.map((cause) => (
              <button
                className="exam-fix__cause"
                type="button"
                key={cause.id}
                onClick={() => step((current) => setCause(current, cause.id))}
              >
                {cause.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {state.phase === 'done' ? (
        <div className="exam-fix__step exam-fix__done">
          <p className="exam-fix__done-head">
            <Check size={18} strokeWidth={2} /> Error diagnosed.
          </p>
          <ul className="exam-fix__facts">
            <li>
              {state.attempts === 1
                ? 'You went straight to the key on the redo.'
                : `It took ${state.attempts} tries on the redo — worth another look at this skill.`}
            </li>
            {question.subtopic ? <li>Skill: {question.subtopic}</li> : null}
          </ul>
          <button
            className="exam-button exam-button--primary"
            type="button"
            onClick={() => onFixed(question.id)}
          >
            {remaining.length > 1 ? 'Next miss' : 'Unlock the full review'}
          </button>
        </div>
      ) : null}

      <WordLookupPopover
        state={wordLookup.state}
        onClose={wordLookup.close}
        onToggleSave={wordLookup.toggleSave}
        onRetry={wordLookup.retry}
      />
    </section>
  )
}
