import type { Question, ReviewItem } from '../types.ts'

// A queued item points at a question by id. Bank questions are looked up in the
// loaded set; anything filed from a practice exam or a lesson example carries
// its own copy, because those questions are never in the bank. Only an item
// that can produce neither is dropped — a queue must never promise a question
// it cannot show.
export function resolveReviewQuestion(
  byId: Map<string, Question>,
  item: ReviewItem,
): Question | null {
  return byId.get(item.questionId) ?? item.question ?? null
}
