import type { Question, ReviewItem } from '../types.ts'
import { isDue } from './schedule.ts'

export type StreamItem = {
  question: Question
  isReview: boolean
  reviewStage: number
}

function seededKey(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Build a practice stream from a chosen subset, weaving in any due resurfacings
// that belong to that subset. Reviews are mixed among fresh questions (not
// clustered) via a stable id hash, so a resurfaced question is indistinguishable
// from a new one until it's answered.
export function buildStream(
  subset: Question[],
  reviews: Record<string, ReviewItem>,
  now: number,
): StreamItem[] {
  const items: StreamItem[] = subset.map((question) => {
    const review = reviews[question.id]
    const due = review ? isDue(review, now) : false
    return {
      question,
      isReview: due,
      reviewStage: due ? review!.stage : 0,
    }
  })

  return items.sort((a, b) => seededKey(a.question.id) - seededKey(b.question.id))
}

export function dueCount(reviews: Record<string, ReviewItem>, now: number): number {
  return Object.values(reviews).filter((item) => isDue(item, now)).length
}
