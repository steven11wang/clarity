import type { Question } from '../types.ts'

type QuestionReference = Pick<Question, 'id' | 'skill'>

type QuestionIdAttempt = {
  timestamp: number
  questionIds: readonly string[]
}

type SkillAttemptReference = QuestionIdAttempt & {
  purpose: string
}

type RepairAvoidInput = {
  questions: readonly QuestionReference[]
  skill: string
  latestQuizQuestionIds: readonly string[]
  triggeringCheckpointQuestionIds: readonly string[]
}

/**
 * Keep a repair quiz away from both the latest quiz at this level and the
 * questions for this skill in the checkpoint that triggered the repair.
 */
export function repairImmediateAvoidIds({
  questions,
  skill,
  latestQuizQuestionIds,
  triggeringCheckpointQuestionIds,
}: RepairAvoidInput): string[] {
  const skillsByQuestionId = new Map(
    questions.map((question) => [question.id, question.skill]),
  )
  const checkpointIdsForSkill = triggeringCheckpointQuestionIds.filter(
    (questionId) => skillsByQuestionId.get(questionId) === skill,
  )

  return uniqueIds([...latestQuizQuestionIds, ...checkpointIdsForSkill])
}

/**
 * A checkpoint retake avoids its immediately preceding checkpoint plus every
 * same-level repair quiz submitted after that checkpoint.
 */
export function checkpointRetakeImmediateAvoidIds(
  previousCheckpoint: QuestionIdAttempt | undefined,
  sameLevelSkillAttempts: readonly SkillAttemptReference[],
): string[] {
  if (!previousCheckpoint) return []

  const repairIds = sameLevelSkillAttempts
    .filter(
      (attempt) =>
        attempt.purpose === 'checkpoint-repair' &&
        attempt.timestamp > previousCheckpoint.timestamp,
    )
    .sort((a, b) => a.timestamp - b.timestamp)
    .flatMap((attempt) => attempt.questionIds)

  return uniqueIds([...previousCheckpoint.questionIds, ...repairIds])
}

function uniqueIds(questionIds: readonly string[]): string[] {
  return [...new Set(questionIds)]
}
