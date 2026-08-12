import type { Attempt, Confidence, ErrorCause, FirstPass, Question } from '../../types.ts'
import type { ChoiceLetter } from '../../review/ordering.ts'

// The review pass runs on questions missed in the answer pass. Three screens:
// find the right answer yourself, contrast it against what you picked and say
// why yours was wrong, then name why you missed it in the first place.
export type LoopPhase =
  | 'redo' // re-attempt the missed question, answer-until-correct
  | 'contrast' // your answer vs the right one — why was yours wrong?
  | 'cause' // why did you miss it the first time?
  | 'done'

// Why the question was missed in the first place, asked after the breakdown.
export const CAUSES: { id: ErrorCause; label: string }[] = [
  { id: 'misread-passage', label: 'Misread the passage' },
  { id: 'misread-question', label: 'Misread the question' },
  { id: 'trap', label: 'Fell for a trap answer' },
  { id: 'knowledge-gap', label: 'Knowledge gap' },
  { id: 'rushed', label: 'Rushed / ran out of time' },
]

// Selectable reasons a chosen answer was wrong (replaces free text).
export const WRONG_REASONS = [
  'It wasn’t supported by the text',
  'It was too extreme or absolute',
  'It was true but didn’t answer the question',
  'It contradicted the text',
  'It brought in outside or irrelevant information',
  'It only partly fit',
  'I misread the question or passage',
]

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
  pass1StruckChoices: string[]
  attempts: number // redo attempts to reach the correct answer
  wrongChoices: string[]
  errorCause: ErrorCause | null
  whyWrong: string
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

export function toggleChoiceStrikeout(struckChoices: string[], choice: string): string[] {
  return struckChoices.includes(choice)
    ? struckChoices.filter((current) => current !== choice)
    : [...struckChoices, choice]
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
    pass1StruckChoices: firstPass.struckChoices,
    attempts: 0,
    wrongChoices: [],
    errorCause: null,
    whyWrong: '',
  }
}

// Redo the question until the correct choice is found — never reveal the answer
// here. Reaching it opens the contrast screen. A question that was already
// answered correctly (only reachable in a review-all pass) has nothing to
// diagnose, so it finishes there.
export function submitRedo(state: LoopState, choice: string): LoopState {
  const attempts = state.attempts + 1
  if (choice === state.answer) {
    return { ...state, attempts, phase: state.correct ? 'done' : 'contrast' }
  }
  const wrongChoices = state.wrongChoices.includes(choice)
    ? state.wrongChoices
    : [...state.wrongChoices, choice]
  return { ...state, attempts, wrongChoices }
}

// The contrast screen shows both answers side by side with the official
// reasoning one tap away; the student picks why their own answer failed.
export function setContrast(state: LoopState, whyWrong: string): LoopState {
  return { ...state, whyWrong, phase: 'cause' }
}

// Asked last, not first: before the breakdown a student is guessing at their own
// mistake — after it they know whether it was a misread, a trap, or a gap.
export function setCause(state: LoopState, errorCause: ErrorCause): LoopState {
  return { ...state, errorCause, phase: 'done' }
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
      ? { whyWrong: state.whyWrong, whyRight: '', selfGrade: null }
      : null,
    evidenceUnderlined: [],
    evidenceScore: null,
    chainBreakLink: null,
    trapGuess: null,
    trapActual: null,
    hiddenError: false,
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
