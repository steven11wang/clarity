import type {
  Attempt,
  ChainLink,
  Confidence,
  ErrorCause,
  EvidenceScore,
  Question,
  SelfGrade,
  TrapType,
} from '../../types.ts'
import type { ChoiceLetter } from '../../review/ordering.ts'

// The gated phases of the five-step loop. Nothing explanatory is shown before
// the student has generated their own version — the phase order enforces it.
export type LoopPhase =
  | 'answering' // Step 1: pick a choice + confidence (submit locked until both)
  | 'reattempt' // Step 2: wrong — try again, no explanation shown
  | 'cause' // Step 3a: why did you miss it?
  | 'explain' // Step 3b: two one-sentence explanations
  | 'self-grade' // Step 3b: reveal rationale, grade your own match
  | 'evidence' // Step 3.5a: underline the proof sentences
  | 'evidence-grade' // Step 3.5a: reveal reasoning, grade your evidence
  | 'chain' // Step 3.5b: what was actually being asked?
  | 'chain-break' // Step 3.5c: which link did the trap break?
  | 'trap' // Step 4: name the trap (only when the cause was a trap)
  | 'done'

export type LoopState = {
  phase: LoopPhase
  isReview: boolean
  reviewStage: number
  answer: ChoiceLetter
  firstChoice: ChoiceLetter | null
  confidence: Confidence | null
  correct: boolean // first-try correctness — the calibration signal
  attempts: number
  wrongChoices: ChoiceLetter[]
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
  answerMs: number | null // time spent in the answering phase (timed mode)
}

export function initLoop(question: Question, isReview: boolean, reviewStage: number): LoopState {
  return {
    phase: 'answering',
    isReview,
    reviewStage,
    answer: question.answer,
    firstChoice: null,
    confidence: null,
    correct: false,
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
    answerMs: null,
  }
}

// Step 1 → reveal. Correct answers skip the autopsy but still verify evidence
// (that's how "right for the wrong reason" is caught). Wrong answers go to the
// answer-until-correct re-attempt.
export function submitFirst(
  state: LoopState,
  choice: ChoiceLetter,
  confidence: Confidence,
  elapsedMs: number | null = null,
): LoopState {
  const correct = choice === state.answer
  return {
    ...state,
    firstChoice: choice,
    confidence,
    correct,
    attempts: 1,
    wrongChoices: correct ? [] : [choice],
    answerMs: elapsedMs,
    phase: correct ? 'evidence' : 'reattempt',
  }
}

// Step 2. Keep the student generating until the correct choice is found; never
// show the answer or explanation here.
export function submitReattempt(state: LoopState, choice: ChoiceLetter): LoopState {
  const attempts = state.attempts + 1
  if (choice === state.answer) {
    return { ...state, attempts, phase: 'cause' }
  }
  const wrongChoices = state.wrongChoices.includes(choice)
    ? state.wrongChoices
    : [...state.wrongChoices, choice]
  return { ...state, attempts, wrongChoices }
}

export function setCause(state: LoopState, errorCause: ErrorCause): LoopState {
  return { ...state, errorCause, phase: 'explain' }
}

export function setExplain(state: LoopState, whyWrong: string, whyRight: string): LoopState {
  return { ...state, whyWrong, whyRight, phase: 'self-grade' }
}

export function setSelfGrade(state: LoopState, selfGrade: SelfGrade): LoopState {
  return { ...state, selfGrade, phase: 'evidence' }
}

export function setEvidence(state: LoopState, evidenceUnderlined: number[]): LoopState {
  return { ...state, evidenceUnderlined, phase: 'evidence-grade' }
}

export function setEvidenceGrade(state: LoopState, evidenceScore: EvidenceScore): LoopState {
  return { ...state, evidenceScore, phase: 'chain' }
}

// Step 3.5b. After the chain, a wrong answer identifies where the trap broke
// the chain; a correct answer is done (or continues only if it was a guess).
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

// "Right for the wrong reason": a correct answer whose evidence missed.
export function isHiddenError(state: LoopState): boolean {
  return state.correct && state.evidenceScore === 'miss'
}

export function toAttempt(state: LoopState, questionId: string, timestamp: number): Attempt {
  const diagnosed = state.errorCause !== null
  return {
    questionId,
    timestamp,
    chosen: state.firstChoice ?? '',
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
    trapActual: null, // no authored per-distractor labels in v1
    hiddenError: isHiddenError(state),
    resurrectionStage: state.reviewStage,
    timeSpentMs: state.answerMs,
    timedOut: false,
  }
}

// The clock expired before the student committed an answer. Records the
// question as a timing failure (no answer, no diagnosis) so it re-enters the
// resurrection queue and comes back — untimed — to actually be worked.
export function buildTimeoutAttempt(
  questionId: string,
  chosen: ChoiceLetter | null,
  confidence: Confidence | null,
  timeSpentMs: number,
  reviewStage: number,
): Attempt {
  return {
    questionId,
    timestamp: Date.now(),
    chosen: chosen ?? '',
    correct: false,
    confidence,
    attemptsToCorrect: 0,
    errorCause: null,
    selfExplanations: null,
    evidenceUnderlined: [],
    evidenceScore: null,
    chainBreakLink: null,
    trapGuess: null,
    trapActual: null,
    hiddenError: false,
    resurrectionStage: reviewStage,
    timeSpentMs,
    timedOut: true,
  }
}
