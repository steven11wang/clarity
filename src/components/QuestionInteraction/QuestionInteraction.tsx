import { useEffect, useMemo, useRef, useState } from 'react'

import type {
  Attempt,
  ChainLink,
  ErrorCause,
  EvidenceScore,
  FirstPass,
  Question,
  SelfGrade,
  TrapType,
} from '../../types.ts'
import { buildIntentChoices } from '../../content/questionIntents.ts'
import { TRAP_TYPES } from '../../content/traps.ts'
import { findReferencedSentences } from '../../review/evidence.ts'
import { orderedChoices, type ChoiceSlot } from '../../review/ordering.ts'
import { Passage } from '../Passage/Passage.tsx'
import { AbcToggle, ChoiceMarker } from './ChoiceStrikeout.tsx'
import {
  initReview,
  isHiddenError,
  setCause,
  setChain,
  setChainBreak,
  setEvidence,
  setEvidenceGrade,
  setExplain,
  setSelfGrade,
  setTrap,
  submitRedo,
  toggleChoiceStrikeout,
  toAttempt,
  answerChoiceStatus,
} from './model.ts'

const CAUSES: { id: ErrorCause; label: string }[] = [
  { id: 'misread-passage', label: 'Misread the passage' },
  { id: 'misread-question', label: 'Misread the question' },
  { id: 'trap', label: 'Fell for a trap answer' },
  { id: 'knowledge-gap', label: 'Knowledge gap' },
  { id: 'rushed', label: 'Rushed / ran out of time' },
]

const GRADES: { id: SelfGrade; label: string }[] = [
  { id: 'matched', label: 'Matched' },
  { id: 'partly', label: 'Partly' },
  { id: 'missed', label: 'Missed it' },
]

const EVIDENCE_GRADES: { id: EvidenceScore; label: string }[] = [
  { id: 'full', label: 'Matched' },
  { id: 'partial', label: 'Partly' },
  { id: 'miss', label: 'Missed it' },
]

const CHAIN_LINKS: { id: ChainLink; label: string; hint: string }[] = [
  { id: 'fact', label: 'Fact', hint: 'The evidence itself was wrong.' },
  { id: 'question', label: 'Question', hint: 'A real fact — but not what was asked.' },
  { id: 'answer', label: 'Answer', hint: 'Right idea, wrong choice matched to it.' },
]

// Selectable reasons a chosen answer was wrong (replaces free text).
const WRONG_REASONS = [
  'It wasn’t supported by the text',
  'It was too extreme or absolute',
  'It was true but didn’t answer the question',
  'It contradicted the text',
  'It brought in outside or irrelevant information',
  'It only partly fit',
  'I misread the question or passage',
]

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
  const [evidenceSel, setEvidenceSel] = useState<number[]>([])
  const [struckChoices, setStruckChoices] = useState<string[]>([])
  const [abcMode, setAbcMode] = useState(false)

  useEffect(() => {
    setStruckChoices([])
    setAbcMode(false)
  }, [question.id])

  const choiceSlots = useMemo(() => orderedChoices(question, isReview), [question, isReview])
  const intent = useMemo(() => buildIntentChoices(question.skill, question.id), [question])
  const referenced = useMemo(
    () => findReferencedSentences(question.passage, question.rationale),
    [question],
  )
  const answerText = question.choices[question.answer]

  const completedRef = useRef(false)
  useEffect(() => {
    if (state.phase === 'done' && !completedRef.current) {
      completedRef.current = true
      onComplete(toAttempt(state, question.id, Date.now()))
    }
  }, [state, question.id, onComplete])

  const evidenceMode = state.phase === 'evidence'
  const showReferenced = state.phase === 'evidence-grade' || state.phase === 'done'

  return (
    <>
      <Passage
        question={question}
        selectable={evidenceMode}
        selected={evidenceMode ? evidenceSel : state.evidenceUnderlined}
        onToggle={(i) =>
          setEvidenceSel((sel) => (sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i]))
        }
        referenced={showReferenced ? referenced : []}
      />

      <section className="question-panel">
        <div className="question-heading">
          <h1 className="question-prompt">{question.prompt}</h1>
          <AbcToggle active={abcMode} onToggle={() => setAbcMode((active) => !active)} />
        </div>

        {/* Redo: re-attempt the missed question, answer-until-correct. */}
        {state.phase === 'redo' && (
          <>
            <p className="panel-label">
              {firstPass.timedOut
                ? 'You ran out of time on this one — you didn’t lock an answer. Work it through now, no clock.'
                : 'You missed this in the set. Your answer is marked below — redo it and find the right one before we break it down.'}
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
                      <span className="choice-text">{slot.text}</span>
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
              <p className="nudge">Not this one — try again. Every option you rule out is one that can’t catch you on test day.</p>
            )}
          </>
        )}

        {state.phase === 'cause' && (
          <div className="step">
            <p className="panel-label">You found it. Why did you miss it the first time?</p>
            <div className="stack">
              {CAUSES.map((c) => (
                <button key={c.id} type="button" className="option" onClick={() => setState((s) => setCause(s, c.id))}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.phase === 'explain' && (
          <div className="step">
            <p className="panel-label">Why was your answer wrong? Pick the closest reason — before you see the explanation.</p>
            <select className="reason-select" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Why your answer was wrong">
              <option value="" disabled>Choose a reason…</option>
              {WRONG_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button type="button" className="button button--full" disabled={!reason} onClick={() => setState((s) => setExplain(s, reason))}>
              See the reasoning
            </button>
          </div>
        )}

        {state.phase === 'self-grade' && (
          <div className="step">
            <div className="compare">
              <div>
                <p className="panel-label">Your reason</p>
                <p className="you-said">“{reason}”</p>
              </div>
              <div>
                <p className="panel-label">The reasoning</p>
                <p className="rationale">{question.rationale}</p>
              </div>
            </div>
            <AnswerChoiceComparison question={question} choiceSlots={choiceSlots} firstChoice={firstPass.chosen} />
            <p className="panel-label">How close was your reason?</p>
            <div className="confidence-row">
              {GRADES.map((g) => (
                <button key={g.id} type="button" className="pill" onClick={() => setState((s) => setSelfGrade(s, g.id, question.domain === 'Standard English Conventions'))}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.phase === 'evidence' && (
          <div className="step">
            <p className="panel-label">
              Before the explanation: tap the sentence(s) in the passage that prove the correct answer.
            </p>
            <p className="evidence-answer">Correct answer: <strong>{answerText}</strong></p>
            <button
              type="button"
              className="button button--full"
              disabled={evidenceSel.length === 0}
              onClick={() => setState((s) => setEvidence(s, [...evidenceSel].sort((a, b) => a - b)))}
            >
              Continue
            </button>
          </div>
        )}

        {state.phase === 'evidence-grade' && (
          <div className="step">
            <p className="rationale">{question.rationale}</p>
            {referenced.length > 0 && (
              <p className="hint">The highlighted sentence is what the reasoning leans on.</p>
            )}
            <AnswerChoiceComparison question={question} choiceSlots={choiceSlots} firstChoice={firstPass.chosen} />
            <p className="panel-label">Did your underline land on the evidence?</p>
            <div className="confidence-row">
              {EVIDENCE_GRADES.map((g) => (
                <button key={g.id} type="button" className="pill" onClick={() => setState((s) => setEvidenceGrade(s, g.id))}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.phase === 'chain' && (
          <div className="step">
            <div className="chain">
              <div className="chain-node chain-node--filled">
                <span className="chain-tag">Fact</span>
                <span>Your underlined evidence</span>
              </div>
              <div className="chain-arrow" aria-hidden="true">↓</div>
              <div className="chain-node chain-node--open">
                <span className="chain-tag">Question</span>
                <span>What was actually being asked?</span>
              </div>
            </div>
            <div className="stack">
              {intent.options.map((opt, i) => (
                <button key={i} type="button" className="option" onClick={() => setState((s) => setChain(s, i, i === intent.correctIndex))}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.phase === 'chain-break' && (
          <div className="step">
            <p className="panel-label">Your first answer connected a real chain — until it snapped. Where?</p>
            <div className="stack">
              {CHAIN_LINKS.map((l) => (
                <button key={l.id} type="button" className="option option--rich" onClick={() => setState((s) => setChainBreak(s, l.id))}>
                  <strong>{l.label}</strong>
                  <span>{l.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {state.phase === 'trap' && (
          <div className="step">
            <p className="panel-label">Name the trap you fell for — so you’ll spot it next time.</p>
            <div className="stack">
              {TRAP_TYPES.map((t) => (
                <button key={t.id} type="button" className="option option--rich" onClick={() => setState((s) => setTrap(s, t.id as TrapType))}>
                  <strong>{t.label}</strong>
                  <span>{t.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {state.phase === 'done' && <DoneStep state={state} onNext={onNext} />}
      </section>
    </>
  )
}

function AnswerChoiceComparison({
  question,
  choiceSlots,
  firstChoice,
}: {
  question: Question
  choiceSlots: ChoiceSlot[]
  firstChoice: string
}) {
  return (
    <div className="answer-comparison" aria-label="Answer choice comparison">
      <p className="panel-label">All answer choices</p>
      {choiceSlots.map((slot) => {
        const { isCorrect, isChosenWrong } = answerChoiceStatus(slot.sourceLetter, question.answer, firstChoice)
        return (
          <div
            className={`answer-comparison__choice ${isCorrect ? 'is-correct' : ''} ${isChosenWrong ? 'is-wrong' : ''}`}
            key={slot.displayLetter}
          >
            <span className="choice-letter">{slot.displayLetter}</span>
            <span>{slot.text}</span>
            {isCorrect && <strong>Correct answer</strong>}
            {isChosenWrong && <strong>Your answer</strong>}
          </div>
        )
      })}
    </div>
  )
}

function DoneStep({ state, onNext }: { state: ReturnType<typeof initReview>; onNext: () => void }) {
  const hidden = isHiddenError(state)
  const priority = state.confidence === 'sure' && !state.correct

  let headline = 'Specimen found. Error diagnosed.'
  if (hidden) headline = 'Right answer, wrong reason — caught it.'

  return (
    <div className="step done">
      <p className="done-headline">{headline}</p>
      <ul className="done-facts">
        {priority && <li className="done-flag">You were sure — and missed it. That’s your single most fixable error.</li>}
        {state.pass1TimedOut && <li>You ran out of time on this in the set — now you’ve worked it properly.</li>}
        <li>This one rejoins your practice — disguised — until you clear it with the right evidence.</li>
      </ul>
      <button type="button" className="button button--full" onClick={onNext}>
        Next
      </button>
    </div>
  )
}
