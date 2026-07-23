import type { EvidenceScore, ReviewItem } from '../types.ts'

const DAY = 24 * 60 * 60 * 1000

// Real spaced intervals: ~2 days, ~7 days, ~30 days.
export const REVIEW_INTERVALS_MS = [2 * DAY, 7 * DAY, 30 * DAY]

// Demo mode compresses the same three stages to seconds so the whole
// resurrection loop is testable in one sitting.
export const DEMO_INTERVALS_MS = [20 * 1000, 60 * 1000, 180 * 1000]

export function intervalsFor(demo: boolean): number[] {
  return demo ? DEMO_INTERVALS_MS : REVIEW_INTERVALS_MS
}

export const RETIRED_STAGE = -1

export function isRetired(item: ReviewItem): boolean {
  return item.stage === RETIRED_STAGE
}

export function isDue(item: ReviewItem, now: number): boolean {
  return !isRetired(item) && item.dueAt <= now
}

// A fresh mistake (or a "right for the wrong reason" hidden error) enters the
// queue at stage 0. If the same question is already queued, its schedule is
// reset — a repeated miss shouldn't inherit progress toward retirement.
export function scheduleMistake(
  existing: ReviewItem | null,
  questionId: string,
  reason: ReviewItem['reason'],
  demo: boolean,
  now: number,
): ReviewItem {
  const dueAt = now + intervalsFor(demo)[0]
  return {
    questionId,
    createdAt: existing?.createdAt ?? now,
    dueAt,
    stage: 0,
    reason,
    clears: 0,
    lastReviewedAt: existing?.lastReviewedAt ?? null,
  }
}

// Did a resurfacing clear this stage? A correct answer clears — unless its
// evidence was checked and clearly missed ("right for the wrong reason"). In
// missed-only review a correct answer isn't evidence-checked (score is null),
// so correctness alone clears it.
export function isClean(correct: boolean, evidenceScore: EvidenceScore | null): boolean {
  return correct && evidenceScore !== 'miss'
}

// Apply a resurfacing result to a queued item. A clean clear advances a stage
// (and retires after the last one); anything else drops it back to stage 0 so
// it comes due again soon.
export function applyReview(
  item: ReviewItem,
  clean: boolean,
  demo: boolean,
  now: number,
): ReviewItem {
  const intervals = intervalsFor(demo)
  if (!clean) {
    return { ...item, stage: 0, clears: 0, dueAt: now + intervals[0], lastReviewedAt: now }
  }
  const nextStage = item.stage + 1
  const clears = item.clears + 1
  if (nextStage >= intervals.length) {
    return { ...item, stage: RETIRED_STAGE, clears, dueAt: now, lastReviewedAt: now }
  }
  return { ...item, stage: nextStage, clears, dueAt: now + intervals[nextStage], lastReviewedAt: now }
}
