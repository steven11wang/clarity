import type { Attempt, Confidence, ErrorCause, ReviewItem } from '../types.ts'
import { RETIRED_STAGE } from './schedule.ts'

export const CONFIDENCE_ORDER: Confidence[] = ['sure', 'leaning', 'guessing']

export type CalibrationRow = { confidence: Confidence; total: number; correct: number }

export type Stats = {
  totalAttempts: number
  errorsDiagnosed: number
  timedOut: number
  autopsies: number
  causeBreakdown: { cause: ErrorCause; count: number }[]
  calibration: CalibrationRow[]
  queue: { outstanding: number; retired: number; dueToday: number }
}

export const REVIEW_REASON_LABELS: Record<ReviewItem['reason'], string> = {
  miss: 'Missed',
  'hidden-error': 'Right for the wrong reason',
  timeout: 'Ran out of time',
}

export function computeStats(
  attempts: Attempt[],
  reviews: Record<string, ReviewItem>,
  nowTs: number,
): Stats {
  const causeCounts = new Map<ErrorCause, number>()
  const calib = new Map<Confidence, { total: number; correct: number }>(
    CONFIDENCE_ORDER.map((c) => [c, { total: 0, correct: 0 }]),
  )

  let errorsDiagnosed = 0
  let timedOut = 0
  let autopsies = 0

  for (const attempt of attempts) {
    if (!attempt.correct) errorsDiagnosed += 1
    if (attempt.timedOut) timedOut += 1
    if (attempt.errorCause) {
      autopsies += 1
      causeCounts.set(attempt.errorCause, (causeCounts.get(attempt.errorCause) ?? 0) + 1)
    }
    if (attempt.confidence) {
      const row = calib.get(attempt.confidence)!
      row.total += 1
      if (attempt.correct) row.correct += 1
    }
  }

  const items = Object.values(reviews)
  const outstanding = items.filter((i) => i.stage !== RETIRED_STAGE).length
  const retired = items.filter((i) => i.stage === RETIRED_STAGE).length
  const dueToday = items.filter((i) => i.stage !== RETIRED_STAGE && i.dueAt <= nowTs).length

  return {
    totalAttempts: attempts.length,
    errorsDiagnosed,
    timedOut,
    autopsies,
    causeBreakdown: [...causeCounts.entries()]
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count),
    calibration: CONFIDENCE_ORDER.map((confidence) => ({ confidence, ...calib.get(confidence)! })),
    queue: { outstanding, retired, dueToday },
  }
}

// Upcoming resurfacings, soonest first — used by the session summary.
export function upcomingReviews(
  reviews: Record<string, ReviewItem>,
  limit = 5,
): ReviewItem[] {
  return Object.values(reviews)
    .filter((i) => i.stage !== RETIRED_STAGE)
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, limit)
}

export function formatDue(dueAt: number, nowTs: number): string {
  const delta = dueAt - nowTs
  if (delta <= 0) return 'due now'
  const mins = Math.round(delta / 60000)
  if (mins < 60) return `in ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `in ${hours} h`
  const days = Math.round(hours / 24)
  return `in ${days} d`
}
