import {
  canStartCheckpoint,
  getSkillPracticeLevel,
  type ProgressionState,
  type SkillQuizPurpose,
} from './model.ts'
import {
  LEVELS,
  SAT_DOMAINS,
  levelToDifficulty,
  type Level,
  type SatDomain,
} from './config.ts'
import type { QuestionTaxonomy } from './questions.ts'
import type { ChoiceLetter } from '../review/ordering.ts'
import type { AdaptiveAssessmentDraft } from '../storage/index.ts'
import type { Question } from '../types.ts'

export type SkillAssessment = {
  kind: 'skill'
  id: string
  domain: SatDomain
  skill: string
  level: Level
  purpose: SkillQuizPurpose
  questions: Question[]
  reusedCount: number
}

export type DiagnosticAssessment = {
  kind: 'diagnostic'
  id: string
  domain: SatDomain
  level: Level
  questions: Question[]
  reusedCount: number
}

export type CheckpointAssessment = {
  kind: 'checkpoint'
  id: string
  domain: SatDomain
  level: 'Adventurer' | 'Master'
  questions: Question[]
  reusedCount: number
}

export type AdaptiveAssessment =
  | DiagnosticAssessment
  | SkillAssessment
  | CheckpointAssessment

export type RestoredAdaptiveAssessment = {
  assessment: AdaptiveAssessment
  answers: Record<string, ChoiceLetter>
}

export function createAdaptiveDraft(
  assessment: AdaptiveAssessment,
  answers: Record<string, ChoiceLetter>,
  progressionConfirmedAt: number,
): AdaptiveAssessmentDraft {
  const descriptor =
    assessment.kind === 'skill'
      ? {
          kind: assessment.kind,
          id: assessment.id,
          domain: assessment.domain,
          skill: assessment.skill,
          level: assessment.level,
          purpose: assessment.purpose,
          questionIds: assessment.questions.map((question) => question.id),
          reusedCount: assessment.reusedCount,
        }
      : assessment.kind === 'diagnostic'
        ? {
            kind: assessment.kind,
            id: assessment.id,
            domain: assessment.domain,
            level: assessment.level,
            questionIds: assessment.questions.map((question) => question.id),
            reusedCount: assessment.reusedCount,
          }
        : {
          kind: assessment.kind,
          id: assessment.id,
          domain: assessment.domain,
          level: assessment.level,
          questionIds: assessment.questions.map((question) => question.id),
          reusedCount: assessment.reusedCount,
        }

  return {
    schemaVersion: 1,
    progressionConfirmedAt,
    assessment: descriptor,
    answers: { ...answers },
  }
}

/**
 * Restore only a draft that is still legal for the current state machine.
 * A completed transition changes attempt counts, making its old draft stale.
 */
export function restoreAdaptiveDraft(
  value: unknown,
  questions: readonly Question[],
  progression: ProgressionState | null,
  taxonomy: QuestionTaxonomy,
): RestoredAdaptiveAssessment | null {
  if (
    !progression ||
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.progressionConfirmedAt !== progression.onboarding.confirmedAt ||
    !isRecord(value.assessment)
  ) {
    return null
  }

  const descriptor = value.assessment
  const domain = descriptor.domain
  if (
    typeof domain !== 'string' ||
    !SAT_DOMAINS.includes(domain as SatDomain) ||
    typeof descriptor.id !== 'string' ||
    !Array.isArray(descriptor.questionIds) ||
    descriptor.questionIds.some((id) => typeof id !== 'string') ||
    new Set(descriptor.questionIds).size !== descriptor.questionIds.length
  ) {
    return null
  }

  const domainName = domain as SatDomain
  const questionMap = new Map(questions.map((question) => [question.id, question]))
  const selectedQuestions = descriptor.questionIds.map((id) => questionMap.get(id))
  if (selectedQuestions.some((question) => !question)) return null
  const hydratedQuestions = selectedQuestions as Question[]
  const reusedCount =
    Number.isInteger(descriptor.reusedCount) &&
    (descriptor.reusedCount as number) >= 0 &&
    (descriptor.reusedCount as number) <= hydratedQuestions.length
      ? (descriptor.reusedCount as number)
      : 0

  let assessment: AdaptiveAssessment
  if (descriptor.kind === 'diagnostic') {
    const restored = restoreDiagnosticAssessment(
      descriptor,
      domainName,
      hydratedQuestions,
      reusedCount,
      progression,
      taxonomy,
    )
    if (!restored) return null
    assessment = restored
  } else if (descriptor.kind === 'skill') {
    const restored = restoreSkillAssessment(
      descriptor,
      domainName,
      hydratedQuestions,
      reusedCount,
      progression,
    )
    if (!restored) return null
    assessment = restored
  } else if (descriptor.kind === 'checkpoint') {
    const restored = restoreCheckpointAssessment(
      descriptor,
      domainName,
      hydratedQuestions,
      reusedCount,
      progression,
      taxonomy,
    )
    if (!restored) return null
    assessment = restored
  } else {
    return null
  }

  return {
    assessment,
    answers: restoreAnswers(value.answers, descriptor.questionIds),
  }
}

function restoreDiagnosticAssessment(
  descriptor: Record<string, unknown>,
  domain: SatDomain,
  questions: Question[],
  reusedCount: number,
  progression: ProgressionState,
  taxonomy: QuestionTaxonomy,
): DiagnosticAssessment | null {
  const level = descriptor.level
  const domainProgress = progression.domains[domain]
  if (
    typeof level !== 'string' ||
    !LEVELS.includes(level as Level) ||
    level !== domainProgress.unlockedLevel ||
    domainProgress.diagnostic.completedAt !== null
  ) {
    return null
  }
  const typedLevel = level as Level
  const expectedId = `diagnostic:${domain}:${typedLevel}:0`
  const skills = taxonomy[domain]
  if (
    descriptor.id !== expectedId ||
    questions.length !== skills.length * 3 ||
    questions.some(
      (question) =>
        question.domain !== domain ||
        question.difficulty !== levelToDifficulty(typedLevel) ||
        !skills.includes(question.skill),
    ) ||
    skills.some(
      (skill) =>
        questions.filter((question) => question.skill === skill).length !== 3,
    )
  ) {
    return null
  }
  return {
    kind: 'diagnostic',
    id: expectedId,
    domain,
    level: typedLevel,
    questions,
    reusedCount,
  }
}

function restoreSkillAssessment(
  descriptor: Record<string, unknown>,
  domain: SatDomain,
  questions: Question[],
  reusedCount: number,
  progression: ProgressionState,
): SkillAssessment | null {
  const skill = descriptor.skill
  const level = descriptor.level
  const purpose = descriptor.purpose
  if (
    typeof skill !== 'string' ||
    !progression.domains[domain].skills[skill] ||
    typeof level !== 'string' ||
    !LEVELS.includes(level as Level) ||
    (purpose !== 'training' && purpose !== 'checkpoint-repair') ||
    questions.length !== 3
  ) {
    return null
  }

  const practiceLevel = getSkillPracticeLevel(progression, domain, skill)
  const typedLevel = level as Level
  const skillProgress = progression.domains[domain].skills[skill]
  const checkpointRepair =
    skillProgress.remediation?.purpose === 'checkpoint-repair' ||
    (practiceLevel !== 'Noobie' &&
      progression.domains[domain].checkpoints[practiceLevel].repairSkills.includes(
        skill,
      ))
  const expectedPurpose: SkillQuizPurpose = checkpointRepair
    ? 'checkpoint-repair'
    : 'training'
  const expectedId = `skill:${domain}:${skill}:${typedLevel}:${skillProgress.levels[typedLevel].attempts.length}`

  if (
    typedLevel !== practiceLevel ||
    purpose !== expectedPurpose ||
    descriptor.id !== expectedId ||
    questions.some(
      (question) =>
        question.domain !== domain ||
        question.skill !== skill ||
        question.difficulty !== levelToDifficulty(typedLevel),
    )
  ) {
    return null
  }

  return {
    kind: 'skill',
    id: expectedId,
    domain,
    skill,
    level: typedLevel,
    purpose,
    questions,
    reusedCount,
  }
}

function restoreCheckpointAssessment(
  descriptor: Record<string, unknown>,
  domain: SatDomain,
  questions: Question[],
  reusedCount: number,
  progression: ProgressionState,
  taxonomy: QuestionTaxonomy,
): CheckpointAssessment | null {
  const level = descriptor.level
  if (
    (level !== 'Adventurer' && level !== 'Master') ||
    !canStartCheckpoint(progression, domain, level)
  ) {
    return null
  }

  const checkpoint = progression.domains[domain].checkpoints[level]
  const expectedId = `checkpoint:${domain}:${level}:${checkpoint.attempts.length}`
  const skills = taxonomy[domain]
  if (
    descriptor.id !== expectedId ||
    questions.length !== skills.length * 3 ||
    questions.some(
      (question) =>
        question.domain !== domain ||
        question.difficulty !== levelToDifficulty(level) ||
        !skills.includes(question.skill),
    ) ||
    skills.some(
      (skill) =>
        questions.filter((question) => question.skill === skill).length !== 3,
    )
  ) {
    return null
  }

  return {
    kind: 'checkpoint',
    id: expectedId,
    domain,
    level,
    questions,
    reusedCount,
  }
}

function restoreAnswers(
  value: unknown,
  questionIds: readonly string[],
): Record<string, ChoiceLetter> {
  if (!isRecord(value)) return {}
  const validIds = new Set(questionIds)
  const answers: Record<string, ChoiceLetter> = {}
  for (const [questionId, answer] of Object.entries(value)) {
    if (
      validIds.has(questionId) &&
      (answer === 'A' || answer === 'B' || answer === 'C' || answer === 'D')
    ) {
      answers[questionId] = answer
    }
  }
  return answers
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
