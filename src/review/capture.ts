import { getReview, getSettings, now, recordAttempt, saveReview } from '../storage/index.ts'
import type { MissSource, Question, ReviewItem } from '../types.ts'
import { scheduleMistake } from './schedule.ts'

// One door into the resurrection queue.
//
// Clarity marks answers wrong in more places than the practice engine: the
// diagnostic and its skill quizzes, a lesson's worked example, a full practice
// exam. Every one of those is a miss the student should see again, so each
// calls captureMiss instead of keeping its own private tally. The queue — and
// therefore the vault and the daily return — is the complete record.

export const MISS_SOURCE_LABELS: Record<MissSource, string> = {
  practice: 'Practice set',
  diagnostic: 'Full diagnostic',
  'skill-quiz': 'Skill quiz',
  checkpoint: 'Checkpoint',
  lesson: 'Lesson example',
  exam: 'Practice exam',
  arena: 'Arena battle',
}

export function missSourceLabel(source: MissSource | undefined): string {
  return source ? MISS_SOURCE_LABELS[source] : MISS_SOURCE_LABELS.practice
}

export type MissCapture = {
  question: Question
  source: MissSource
  // What the student picked; '' when they left it blank or the clock ran out.
  chosen: string
  reason?: ReviewItem['reason']
  // Whether the question lives in the loaded practice bank. Anything else
  // carries a copy of itself into the queue so it can still be handed back.
  inBank?: boolean
  timestamp?: number
}

// File one miss: log the attempt, then schedule (or reset) its return. Safe to
// call for the same question twice — a repeated miss restarts the ladder, which
// is exactly what scheduleMistake does.
export function captureMiss({
  question,
  source,
  chosen,
  reason = 'miss',
  inBank = false,
  timestamp = Date.now(),
}: MissCapture): void {
  recordAttempt({
    questionId: question.id,
    timestamp,
    chosen,
    correct: false,
    confidence: null,
    attemptsToCorrect: 0,
    errorCause: null,
    selfExplanations: null,
    evidenceUnderlined: [],
    evidenceScore: null,
    chainBreakLink: null,
    trapGuess: null,
    trapActual: null,
    hiddenError: false,
    resurrectionStage: getReview(question.id)?.stage ?? 0,
    timeSpentMs: null,
    timedOut: reason === 'timeout',
  })

  const item = scheduleMistake(
    getReview(question.id),
    question.id,
    reason,
    getSettings().demoMode,
    now(),
  )
  saveReview({
    ...item,
    source,
    ...(inBank ? {} : { question }),
  })
}
