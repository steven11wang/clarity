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
import { orderedChoices } from '../../review/ordering.ts'
import { Passage } from '../Passage/Passage.tsx'
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
  toAttempt,
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

  const [whyWrong, setWhyWrong] = useState('')
  const [whyRight, setWhyRight] = useState('')
  const [evidenceSel, setEvidenceSel] = useState<number[]>([])

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
        <h1 className="question-prompt">{question.prompt}</h1>

        {/* Redo: re-attempt the missed question, answer-until-correct. */}
        {state.phase === 'redo' && (
          <>
            <p className="panel-label">
              {firstPass.timedOut
                ? 'You ran out of time on this one. Work it through now — no clock.'
                : 'You missed this in the set. Redo it — find the answer before we break it down.'}
            </p>
            <div className="choice-list" role="radiogroup" aria-label="Answer choices">
              {choiceSlots.map((slot) => {
                const isRuledOut = state.wrongChoices.includes(slot.sourceLetter)
                const cls = ['choice', isRuledOut ? 'choice--ruled-out' : ''].filter(Boolean).join(' ')
                return (
                  <button
                    key={slot.displayLetter}
                    type="button"
                    className={cls}
                    disabled={isRuledOut}
                    aria-disabled={isRuledOut}
                    onClick={() => setState((s) => submitRedo(s, slot.sourceLetter))}
                  >
                    <span className="choice-letter">{slot.displayLetter}</span>
                    <span>{slot.text}</span>
                  </button>
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
          <ExplainStep
            whyWrong={whyWrong}
            whyRight={whyRight}
            onWhyWrong={setWhyWrong}
            onWhyRight={setWhyRight}
            onContinue={() => setState((s) => setExplain(s, whyWrong.trim(), whyRight.trim()))}
          />
        )}

        {state.phase === 'self-grade' && (
          <div className="step">
            <div className="compare">
              <div>
                <p className="panel-label">You wrote</p>
                <p className="you-said">“{whyRight || whyWrong}”</p>
              </div>
              <div>
                <p className="panel-label">The reasoning</p>
                <p className="rationale">{question.rationale}</p>
              </div>
            </div>
            <p className="panel-label">How well did your reasoning match?</p>
            <div className="confidence-row">
              {GRADES.map((g) => (
                <button key={g.id} type="button" className="pill" onClick={() => setState((s) => setSelfGrade(s, g.id))}>
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
              Lock in my evidence
            </button>
          </div>
        )}

        {state.phase === 'evidence-grade' && (
          <div className="step">
            <p className="rationale">{question.rationale}</p>
            {referenced.length > 0 && (
              <p className="hint">The highlighted sentence is what the reasoning leans on.</p>
            )}
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

function ExplainStep({
  whyWrong,
  whyRight,
  onWhyWrong,
  onWhyRight,
  onContinue,
}: {
  whyWrong: string
  whyRight: string
  onWhyWrong: (v: string) => void
  onWhyRight: (v: string) => void
  onContinue: () => void
}) {
  return (
    <div className="step">
      <p className="panel-label">In one sentence each — no explanation yet, you first.</p>
      <label className="field">
        <span>Why was your answer wrong?</span>
        <input value={whyWrong} onChange={(e) => onWhyWrong(e.target.value)} maxLength={160} placeholder="One sentence…" />
      </label>
      <label className="field">
        <span>Why is the correct one right?</span>
        <input value={whyRight} onChange={(e) => onWhyRight(e.target.value)} maxLength={160} placeholder="One sentence…" />
      </label>
      <button type="button" className="button button--full" disabled={!whyWrong.trim() || !whyRight.trim()} onClick={onContinue}>
        Compare with the reasoning
      </button>
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
