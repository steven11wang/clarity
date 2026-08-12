import type { ExamQuestion, PracticeExam } from './examData.ts'

/**
 * Raw-to-scaled conversion for the Reading and Writing section.
 *
 * Anchored on the one row we have from CookSAT's curve - three wrong lands on
 * 780 - and stepped ten points per extra wrong answer from there. It is an
 * approximation of the real curve, not a published table.
 */
export const SCALE_ANCHOR_WRONG = 3
export const SCALE_ANCHOR_SCORE = 780
export const SCALE_STEP = 10
export const SCALE_MAX = 800
export const SCALE_MIN = 200

export function scaledScore(wrong: number): number {
  const raw = SCALE_ANCHOR_SCORE + (SCALE_ANCHOR_WRONG - wrong) * SCALE_STEP
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, raw))
}

export type SkillTally = {
  name: string
  correct: number
  scored: number
}

export type SkillDomain = SkillTally & {
  subskills: SkillTally[]
}

type Scored = {
  question: ExamQuestion
  correct: boolean
}

/**
 * Groups every scored question by its topic and subtopic. Questions the bank
 * ships untagged land under 'Untagged' rather than vanishing from the totals.
 */
export function skillBreakdown(
  exam: PracticeExam,
  answers: Record<string, string>,
): SkillDomain[] {
  const scored: Scored[] = exam.modules.flatMap((module) =>
    module.questions
      .filter((question) => question.answer !== null)
      .map((question) => ({
        question,
        correct: answers[question.id] === question.answer,
      })),
  )

  const domains = new Map<string, Map<string, SkillTally>>()
  const totals = new Map<string, { correct: number; scored: number }>()

  for (const entry of scored) {
    const topic = entry.question.topic ?? 'Untagged'
    const subtopic = entry.question.subtopic ?? 'Untagged'
    if (!domains.has(topic)) {
      domains.set(topic, new Map())
      totals.set(topic, { correct: 0, scored: 0 })
    }
    const subskills = domains.get(topic)!
    if (!subskills.has(subtopic)) {
      subskills.set(subtopic, { name: subtopic, correct: 0, scored: 0 })
    }
    const subskill = subskills.get(subtopic)!
    const total = totals.get(topic)!
    subskill.scored += 1
    total.scored += 1
    if (entry.correct) {
      subskill.correct += 1
      total.correct += 1
    }
  }

  return [...domains].map(([name, subskills]) => ({
    name,
    correct: totals.get(name)!.correct,
    scored: totals.get(name)!.scored,
    subskills: [...subskills.values()],
  }))
}
