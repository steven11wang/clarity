import type {
  Attempt,
  ChainLink,
  Confidence,
  ErrorCause,
  EvidenceScore,
  FirstPass,
  Question,
  SelfGrade,
  TrapType,
} from '../../types.ts'
import type { ChoiceLetter } from '../../review/ordering.ts'

// The review pass runs on questions missed in the answer pass. The gated phases
// still enforce generation-before-revelation: redo it yourself, diagnose it
// yourself, and only then see the official reasoning.
export type LoopPhase =
  | 'redo' // re-attempt the missed question, answer-until-correct
  | 'cause' // Step 3a: why did you miss it?
  | 'explain' // Step 3b: two one-sentence explanations
  | 'self-grade' // Step 3b: reveal rationale, grade your own match
  | 'evidence' // Step 3.5a: underline the proof sentences
  | 'evidence-grade' // Step 3.5a: reveal reasoning, grade your evidence
  | 'chain' // Step 3.5b: what was actually being asked?
  | 'chain-break' // Step 3.5c: which link did the trap break?
  | 'trap' // Step 4: name the trap
  | 'done'

export type LoopState = {
  phase: LoopPhase
  reviewStage: number
  answer: ChoiceLetter
  // Carried from the answer pass — the committed answer is what counts for
  // calibration and the error log; the redo below is for learning.
  firstChoice: string
  confidence: Confidence | null
  correct: boolean
  pass1TimeMs: number | null
  pass1TimedOut: boolean
  attempts: number // redo attempts to reach the correct answer
  wrongChoices: string[]
  errorCause: ErrorCause | null
  whyWrong: string
  whyRight: string
  selfGrade: SelfGrade | null
  evidenceUnderlined: number[]
  evidenceScore: EvidenceScore | null
  intentPick: number | null
  intentCorrect: boolean | null
  chainBreakLink: ChainLink | null
  trapGuess: TrapType | null
}

export function answerChoiceStatus(
  sourceLetter: string,
  correctLetter: string,
  firstChoice: string,
): { isCorrect: boolean; isChosenWrong: boolean } {
  return {
    isCorrect: sourceLetter === correctLetter,
    isChosenWrong: firstChoice !== '' && sourceLetter === firstChoice && sourceLetter !== correctLetter,
  }
}

export function initReview(
  question: Question,
  firstPass: FirstPass,
  reviewStage: number,
): LoopState {
  return {
    phase: 'redo',
    reviewStage,
    answer: question.answer,
    firstChoice: firstPass.chosen,
    confidence: firstPass.confidence,
    correct: firstPass.correct,
    pass1TimeMs: firstPass.timeMs,
    pass1TimedOut: firstPass.timedOut,
    attempts: 0,
    wrongChoices: [],
    errorCause: null,
    whyWrong: '',
    whyRight: '',
    selfGrade: null,
    evidenceUnderlined: [],
    evidenceScore: null,
    intentPick: null,
    intentCorrect: null,
    chainBreakLink: null,
    trapGuess: null,
  }
}

// Redo the question until the correct choice is found — never reveal the answer
// here. Reaching it opens the autopsy (or the evidence check, if the committed
// answer was actually right and this is a review-all pass).
export function submitRedo(state: LoopState, choice: string): LoopState {
  const attempts = state.attempts + 1
  if (choice === state.answer) {
    return { ...state, attempts, phase: state.correct ? 'evidence' : 'cause' }
  }
  const wrongChoices = state.wrongChoices.includes(choice)
    ? state.wrongChoices
    : [...state.wrongChoices, choice]
  return { ...state, attempts, wrongChoices }
}

export function setCause(state: LoopState, errorCause: ErrorCause): LoopState {
  return { ...state, errorCause, phase: 'explain' }
}

// The student picks why their answer was wrong (a distractor-flaw reason) before
// the reasoning is revealed. "Why is the correct one right?" was removed — the
// official rationale answers that on the next screen.
export function setExplain(state: LoopState, whyWrong: string): LoopState {
  return { ...state, whyWrong, whyRight: '', phase: 'self-grade' }
}

export function setSelfGrade(
  state: LoopState,
  selfGrade: SelfGrade,
  skipEvidenceChain = false,
): LoopState {
  return { ...state, selfGrade, phase: skipEvidenceChain ? 'done' : 'evidence' }
}

export function setEvidence(state: LoopState, evidenceUnderlined: number[]): LoopState {
  return { ...state, evidenceUnderlined, phase: 'evidence-grade' }
}

export function setEvidenceGrade(state: LoopState, evidenceScore: EvidenceScore): LoopState {
  return { ...state, evidenceScore, phase: 'chain' }
}

export function setChain(state: LoopState, intentPick: number, intentCorrect: boolean): LoopState {
  return {
    ...state,
    intentPick,
    intentCorrect,
    phase: state.correct ? 'done' : 'chain-break',
  }
}

export function setChainBreak(state: LoopState, chainBreakLink: ChainLink): LoopState {
  return {
    ...state,
    chainBreakLink,
    phase: state.errorCause === 'trap' ? 'trap' : 'done',
  }
}

export function setTrap(state: LoopState, trapGuess: TrapType): LoopState {
  return { ...state, trapGuess, phase: 'done' }
}

// "Right for the wrong reason": a correct answer whose evidence missed. Only
// reachable in a review-all pass, since missed-only never evidence-checks a
// correct answer.
export function isHiddenError(state: LoopState): boolean {
  return state.correct && state.evidenceScore === 'miss'
}

export function toAttempt(state: LoopState, questionId: string, timestamp: number): Attempt {
  const diagnosed = state.errorCause !== null
  return {
    questionId,
    timestamp,
    chosen: state.firstChoice,
    correct: state.correct,
    confidence: state.confidence,
    attemptsToCorrect: state.attempts,
    errorCause: state.errorCause,
    selfExplanations: diagnosed
      ? { whyWrong: state.whyWrong, whyRight: state.whyRight, selfGrade: state.selfGrade }
      : null,
    evidenceUnderlined: state.evidenceUnderlined,
    evidenceScore: state.evidenceScore,
    chainBreakLink: state.chainBreakLink,
    trapGuess: state.trapGuess,
    trapActual: null,
    hiddenError: isHiddenError(state),
    resurrectionStage: state.reviewStage,
    timeSpentMs: state.pass1TimeMs,
    timedOut: state.pass1TimedOut,
  }
}

// A question answered in the answer pass but not sent to review (a correct
// answer) is logged as-is so calibration and the score trend still see it.
export function firstPassAttempt(
  questionId: string,
  firstPass: FirstPass,
  reviewStage: number,
  timestamp: number,
): Attempt {
  return {
    questionId,
    timestamp,
    chosen: firstPass.chosen,
    correct: firstPass.correct,
    confidence: firstPass.confidence,
    attemptsToCorrect: firstPass.correct ? 1 : 0,
    errorCause: null,
    selfExplanations: null,
    evidenceUnderlined: [],
    evidenceScore: null,
    chainBreakLink: null,
    trapGuess: null,
    trapActual: null,
    hiddenError: false,
    resurrectionStage: reviewStage,
    timeSpentMs: firstPass.timeMs,
    timedOut: firstPass.timedOut,
  }
}
