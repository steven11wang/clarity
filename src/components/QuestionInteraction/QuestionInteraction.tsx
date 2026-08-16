import { useEffect, useMemo, useRef, useState } from 'react'

import type { Attempt, FirstPass, Question } from '../../types.ts'
import { LookupText, type TextLookupRequest } from '../../dictionary/LookupText.tsx'
import { resolveChoiceContext } from '../../dictionary/context.ts'
import { useWordLookup } from '../../dictionary/useWordLookup.ts'
import { findReferencedSentences } from '../../review/evidence.ts'
import { orderedChoices, type ChoiceSlot } from '../../review/ordering.ts'
import { WordLookupPopover } from '../Exam/WordLookupPopover.tsx'
import { Passage } from '../Passage/Passage.tsx'
import { AbcToggle, ChoiceMarker, DictionaryToggle } from './ChoiceStrikeout.tsx'
import {
  CAUSES,
  WRONG_REASONS,
  initReview,
  setCause,
  setContrast,
  submitRedo,
  toggleChoiceStrikeout,
  toAttempt,
  answerChoiceStatus,
} from './model.ts'

type Props = {
  question: Question
  isReview: boolean
  firstPass: FirstPass
  reviewStage: number
  onComplete: (attempt: Attempt) => void
  onNext: () => void
}

export function QuestionInteraction({
  question,
  isReview,
  firstPass,
  reviewStage,
  onComplete,
  onNext,
}: Props) {
  const [state, setState] = useState(() => initReview(question, firstPass, reviewStage))

  const [reason, setReason] = useState('')
  const [struckChoices, setStruckChoices] = useState<string[]>([])
  const [abcMode, setAbcMode] = useState(false)
  const [dictionary, setDictionary] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)

  const wordLookup = useWordLookup()

  useEffect(() => {
    setStruckChoices([])
    setAbcMode(false)
    wordLookup.close()
  }, [question.id])

  const choiceSlots = useMemo(() => orderedChoices(question, isReview), [question, isReview])
  const referenced = useMemo(
    () => findReferencedSentences(question.passage, question.rationale),
    [question],
  )

  const completedRef = useRef(false)
  useEffect(() => {
    if (state.phase === 'done' && !completedRef.current) {
      completedRef.current = true
      onComplete(toAttempt(state, question.id, Date.now()))
    }
  }, [state, question.id, onComplete])

  // Once the breakdown starts, the sentence the reasoning leans on stays lit.
  const showReferenced = state.phase !== 'redo'

  return (
    <>
      <Passage
        question={question}
        referenced={showReferenced ? referenced : []}
        dictionary={dictionary}
        onLookup={(req) =>
          wordLookup.open({ ...req, source: { examId: question.test || 'practice', questionId: question.id } })
        }
      />

      <section className="question-panel">
        <div className="question-heading">
          <h1 className="question-prompt">
            <LookupText
              text={question.prompt}
              dictionary={dictionary}
              onLookup={(req) =>
                wordLookup.open({ ...req, source: { examId: question.test || 'practice', questionId: question.id } })
              }
            />
          </h1>
          <div className="question-tools">
            <DictionaryToggle active={dictionary} onToggle={() => setDictionary((d) => !d)} />
            <AbcToggle active={abcMode} onToggle={() => setAbcMode((active) => !active)} />
          </div>
        </div>

        {/* Redo: re-attempt the missed question, answer-until-correct. */}
        {state.phase === 'redo' && (
          <>
            <p className="panel-label">
              {firstPass.timedOut
                ? 'You ran out of time on this one - you didn’t lock an answer. Work it through now, no clock.'
                : 'You missed this in the set. Your answer is marked below - redo it and find the right one before we break it down.'}
            </p>
            <div className="choice-list" role="radiogroup" aria-label="Answer choices">
              {choiceSlots.map((slot) => {
                const isFirstPick = firstPass.chosen !== '' && firstPass.chosen === slot.sourceLetter
                const clickedWrong = state.wrongChoices.includes(slot.sourceLetter)
                const isWrong = isFirstPick || clickedWrong
                const struck = struckChoices.includes(slot.sourceLetter)
                const cls = ['choice', isWrong ? 'choice--wrong' : '', struck ? 'choice--struck' : ''].filter(Boolean).join(' ')
                return (
                  <div
                    key={slot.displayLetter}
                    className={cls}
                  >
                    <button
                      type="button"
                      className="choice-select"
                      disabled={isWrong}
                      aria-disabled={isWrong}
                      aria-label={
                        isFirstPick
                          ? `Choice ${slot.displayLetter}: the answer you chose, incorrect`
                          : clickedWrong
                            ? `Choice ${slot.displayLetter}: incorrect`
                            : undefined
                      }
                      onClick={() => setState((s) => submitRedo(s, slot.sourceLetter))}
                    >
                      <span className="choice-text">
                        <LookupText
                          text={slot.text}
                          dictionary={dictionary}
                          onLookup={(req) =>
                            wordLookup.open({
                              ...req,
                              sentence: resolveChoiceContext({
                                choiceText: slot.text,
                                word: req.word,
                                requestSentence: req.sentence,
                                passage: question.passage,
                                prompt: question.prompt,
                              }),
                              source: { examId: question.test || 'practice', questionId: question.id },
                            })
                          }
                        />
                      </span>
                      {isFirstPick ? (
                        <span className="choice-tag choice-tag--chose">You chose this</span>
                      ) : clickedWrong ? (
                        <span className="choice-tag choice-tag--wrong">Incorrect</span>
                      ) : null}
                    </button>
                    {abcMode && (
                      <ChoiceMarker
                        letter={isWrong ? '✕' : slot.displayLetter}
                        struck={struck}
                        disabled={isWrong}
                        onToggle={() => setStruckChoices((current) => toggleChoiceStrikeout(current, slot.sourceLetter))}
                      />
                    )}
                  </div>
                )
              })}
            </div>
            {state.wrongChoices.length > 0 && (
              <p className="nudge">Not this one - try again. Every option you rule out is one that can’t catch you on test day.</p>
            )}
          </>
        )}

        {/* Contrast: both answers on screen at once, reasoning one tap away, and
            the diagnosis asked while the comparison is still in front of you. */}
        {state.phase === 'contrast' && (
          <div className="step">
            <p className="panel-label">You found it. Now put the two side by side.</p>
            <AnswerChoiceComparison
              question={question}
              choiceSlots={choiceSlots}
              firstChoice={firstPass.chosen}
              struckChoices={state.pass1StruckChoices}
              dictionary={dictionary}
              onLookup={(req) =>
                wordLookup.open({
                  ...req,
                  sentence: resolveChoiceContext({
                    choiceText: req.sentence,
                    word: req.word,
                    requestSentence: req.sentence,
                    passage: question.passage,
                    prompt: question.prompt,
                  }),
                  source: { examId: question.test || 'practice', questionId: question.id },
                })
              }
            />
            <div className="reasoning-head">
              <p className="panel-label">The reasoning</p>
              <button type="button" className="link-button" onClick={() => setShowReasoning((v) => !v)}>
                {showReasoning ? 'Hide' : 'Show'}
              </button>
            </div>
            {showReasoning && <p className="rationale">{question.rationale}</p>}
            <p className="panel-label">Why was your answer wrong?</p>
            <select
              className="reason-select"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label="Why your answer was wrong"
            >
              <option value="" disabled>Choose a reason…</option>
              {WRONG_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              type="button"
              className="button button--full"
              disabled={!reason}
              onClick={() => setState((s) => setContrast(s, reason))}
            >
              Continue
            </button>
          </div>
        )}

        {state.phase === 'cause' && (
          <div className="step">
            <p className="panel-label">Last thing - why did you miss it the first time?</p>
            <div className="stack">
              {CAUSES.map((c) => (
                <button key={c.id} type="button" className="option" onClick={() => setState((s) => setCause(s, c.id))}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.phase === 'done' && <DoneStep state={state} onNext={onNext} />}
      </section>

      <WordLookupPopover
        state={wordLookup.state}
        onClose={wordLookup.close}
        onToggleSave={wordLookup.toggleSave}
        onRetry={wordLookup.retry}
      />
    </>
  )
}

function AnswerChoiceComparison({
  question,
  choiceSlots,
  firstChoice,
  struckChoices,
  dictionary = false,
  onLookup,
}: {
  question: Question
  choiceSlots: ChoiceSlot[]
  firstChoice: string
  struckChoices: string[]
  dictionary?: boolean
  onLookup?: (request: TextLookupRequest) => void
}) {
  return (
    <div className="answer-comparison" aria-label="Answer choice comparison">
      <p className="panel-label">All answer choices</p>
      {choiceSlots.map((slot) => {
        const { isCorrect, isChosenWrong } = answerChoiceStatus(slot.sourceLetter, question.answer, firstChoice)
        const wasStruck = struckChoices.includes(slot.sourceLetter)
        return (
          <div
            className={`answer-comparison__choice ${isCorrect ? 'is-correct' : ''} ${isChosenWrong ? 'is-wrong' : ''} ${wasStruck ? 'was-struck' : ''}`}
            key={slot.displayLetter}
          >
            <span className="choice-letter">{slot.displayLetter}</span>
            <span>
              <LookupText text={slot.text} dictionary={dictionary} onLookup={onLookup} />
              {wasStruck && <em className="answer-comparison__struck-note">You struck this out</em>}
            </span>
            {isCorrect && <strong>Correct answer</strong>}
            {isChosenWrong && <strong>Your answer</strong>}
          </div>
        )
      })}
    </div>
  )
}

function DoneStep({ state, onNext }: { state: ReturnType<typeof initReview>; onNext: () => void }) {
  const priority = state.confidence === 'sure' && !state.correct

  return (
    <div className="step done">
      <p className="done-headline">Error diagnosed.</p>
      <ul className="done-facts">
        {priority && <li className="done-flag">You were sure - and missed it. That’s your single most fixable error.</li>}
        {state.pass1TimedOut && <li>You ran out of time on this in the set - now you’ve worked it properly.</li>}
        <li>This one rejoins your practice - disguised - until you clear it.</li>
      </ul>
      <button type="button" className="button button--full" onClick={onNext}>
        Next
      </button>
    </div>
  )
}
