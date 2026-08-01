import type { ReviewItem } from '../types.ts'

const DAY = 24 * 60 * 60 * 1000

// Real spaced intervals. The zeroth return is the same-session review pass that
// runs right after the answer pass; these are the four returns after it:
// tomorrow, 3 days, a week, a month.
export const REVIEW_INTERVALS_MS = [1 * DAY, 3 * DAY, 7 * DAY, 30 * DAY]

// Demo mode compresses the same four stages to seconds so the whole
// resurrection loop is testable in one sitting.
export const DEMO_INTERVALS_MS = [15 * 1000, 45 * 1000, 90 * 1000, 180 * 1000]

// Human labels for each stage, indexed the same way as the intervals.
export const STAGE_LABELS = ['1 day', '3 days', '1 week', '1 month']

export function stageLabel(stage: number): string {
  return STAGE_LABELS[stage] ?? 'retired'
}

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

// Did a resurfacing clear this stage? Correctness alone clears it.
export function isClean(correct: boolean): boolean {
  return correct
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
