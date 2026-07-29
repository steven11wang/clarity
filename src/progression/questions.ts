import type { Question } from '../types.ts'
import {
  SAT_DOMAINS,
  levelToDifficulty,
  type Level,
  type SatDomain,
} from './config.ts'

export const QUESTIONS_PER_SKILL = 3

export type QuestionTaxonomy = Record<SatDomain, string[]>

type SelectionInputs = {
  questions: readonly Question[]
  domain: SatDomain
  level: Level
  /** Question IDs in persisted chronological order, oldest first. */
  questionIdHistory: readonly string[]
  /** IDs from the immediately preceding quiz, checkpoint, or repair. */
  immediateAvoidIds: readonly string[]
  seed: string | number
  attemptOrdinal: number
}

export type SkillQuestionSelectionInput = SelectionInputs & {
  skill: string
}

export type CheckpointQuestionSelectionInput = SelectionInputs

export type SelectionReuseMetadata = {
  /** Questions seen before, including an immediately avoided ID not yet in history. */
  reusedQuestionIds: string[]
  /** Reused specifically from the caller's immediate-avoid set. */
  immediatelyReusedQuestionIds: string[]
}

export type InsufficientQuestionSelection = {
  ok: false
  reason: 'insufficient-questions'
  domain: SatDomain
  skill: string | null
  level: Level
  difficulty: ReturnType<typeof levelToDifficulty>
  required: typeof QUESTIONS_PER_SKILL
  available: number
}

export type SkillQuestionSelection = {
  ok: true
  questions: [Question, Question, Question]
} & SelectionReuseMetadata

export type CheckpointQuestionSelection = {
  ok: true
  questions: Question[]
  skills: string[]
} & SelectionReuseMetadata

export type SkillQuestionSelectionResult =
  | SkillQuestionSelection
  | InsufficientQuestionSelection

export type CheckpointQuestionSelectionResult =
  | CheckpointQuestionSelection
  | InsufficientQuestionSelection

type Usage = {
  count: number
  lastUsedIndex: number
}

type Candidate = {
  question: Question
  immediatelyAvoided: boolean
  useCount: number
  lastUsedIndex: number
  seededKey: number
}

/**
 * Derive skill membership from the loaded bank while keeping the four product
 * domains in their configured order. Sorting skills makes the result stable
 * even if a regenerated question file arrives in a different record order.
 */
export function buildTaxonomy(questions: readonly Question[]): QuestionTaxonomy {
  const domainSets = Object.fromEntries(
    SAT_DOMAINS.map((domain) => [domain, new Set<string>()]),
  ) as Record<SatDomain, Set<string>>

  for (const question of uniqueQuestions(questions)) {
    const domain = SAT_DOMAINS.find((candidate) => candidate === question.domain)
    if (domain && question.skill.trim()) {
      domainSets[domain].add(question.skill)
    }
  }

  return SAT_DOMAINS.reduce((taxonomy, domain) => {
    taxonomy[domain] = [...domainSets[domain]].sort((a, b) => a.localeCompare(b))
    return taxonomy
  }, {} as QuestionTaxonomy)
}

/**
 * Select exactly three questions for one skill. Selection is deterministic and
 * prioritizes questions outside the immediate-avoid set, then never/least-used
 * questions, then the least-recently used question.
 */
export function selectSkillQuestions(
  input: SkillQuestionSelectionInput,
): SkillQuestionSelectionResult {
  const bank = uniqueQuestions(input.questions)
  const selected = selectLeaf(bank, input)

  if (!selected.ok) {
    return selected
  }

  return {
    ok: true,
    questions: selected.questions,
    ...reuseMetadata(
      selected.questions,
      input.questionIdHistory,
      input.immediateAvoidIds,
    ),
  }
}

/**
 * Select three questions for every skill in a domain and interleave them in a
 * stable round-robin order. A short leaf fails the whole checkpoint atomically.
 */
export function selectCheckpointQuestions(
  input: CheckpointQuestionSelectionInput,
): CheckpointQuestionSelectionResult {
  const bank = uniqueQuestions(input.questions)
  const skills = buildTaxonomy(bank)[input.domain]

  if (skills.length === 0) {
    return insufficient(input, null, 0)
  }

  const bySkill = new Map<string, [Question, Question, Question]>()
  for (const skill of skills) {
    const selected = selectLeaf(bank, { ...input, skill })
    if (!selected.ok) {
      return selected
    }
    bySkill.set(skill, selected.questions)
  }

  const interleavedSkillOrder = seededOrder(
    skills,
    `${input.seed}|${input.attemptOrdinal}|${input.domain}|checkpoint-skills`,
  )
  const questions: Question[] = []
  for (let round = 0; round < QUESTIONS_PER_SKILL; round += 1) {
    for (const skill of interleavedSkillOrder) {
      questions.push(bySkill.get(skill)![round])
    }
  }

  return {
    ok: true,
    questions,
    skills,
    ...reuseMetadata(
      questions,
      input.questionIdHistory,
      input.immediateAvoidIds,
    ),
  }
}

function selectLeaf(
  bank: readonly Question[],
  input: SkillQuestionSelectionInput,
):
  | { ok: true; questions: [Question, Question, Question] }
  | InsufficientQuestionSelection {
  const difficulty = levelToDifficulty(input.level)
  const pool = bank.filter(
    (question) =>
      question.domain === input.domain &&
      question.skill === input.skill &&
      question.difficulty === difficulty,
  )

  if (pool.length < QUESTIONS_PER_SKILL) {
    return insufficient(input, input.skill, pool.length)
  }

  const usage = buildUsage(input.questionIdHistory)
  const immediatelyAvoided = new Set(input.immediateAvoidIds)
  const candidates: Candidate[] = pool.map((question) => {
    const seen = usage.get(question.id)
    return {
      question,
      immediatelyAvoided: immediatelyAvoided.has(question.id),
      useCount: seen?.count ?? 0,
      lastUsedIndex: seen?.lastUsedIndex ?? -1,
      seededKey: stableHash(
        `${input.seed}|${input.attemptOrdinal}|${input.domain}|${input.skill}|${question.id}`,
      ),
    }
  })

  candidates.sort(compareCandidates)
  const questions = candidates
    .slice(0, QUESTIONS_PER_SKILL)
    .map((candidate) => candidate.question) as [Question, Question, Question]

  return { ok: true, questions }
}

function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.immediatelyAvoided !== b.immediatelyAvoided) {
    return Number(a.immediatelyAvoided) - Number(b.immediatelyAvoided)
  }
  if (a.useCount !== b.useCount) {
    return a.useCount - b.useCount
  }
  if (a.lastUsedIndex !== b.lastUsedIndex) {
    return a.lastUsedIndex - b.lastUsedIndex
  }
  if (a.seededKey !== b.seededKey) {
    return a.seededKey - b.seededKey
  }
  return a.question.id.localeCompare(b.question.id)
}

function buildUsage(questionIdHistory: readonly string[]): Map<string, Usage> {
  const usage = new Map<string, Usage>()
  questionIdHistory.forEach((questionId, index) => {
    const previous = usage.get(questionId)
    usage.set(questionId, {
      count: (previous?.count ?? 0) + 1,
      lastUsedIndex: index,
    })
  })
  return usage
}

function reuseMetadata(
  questions: readonly Question[],
  questionIdHistory: readonly string[],
  immediateAvoidIds: readonly string[],
): SelectionReuseMetadata {
  const historical = new Set(questionIdHistory)
  const immediate = new Set(immediateAvoidIds)

  return {
    reusedQuestionIds: questions
      .filter((question) => historical.has(question.id) || immediate.has(question.id))
      .map((question) => question.id),
    immediatelyReusedQuestionIds: questions
      .filter((question) => immediate.has(question.id))
      .map((question) => question.id),
  }
}

function insufficient(
  input: Pick<SelectionInputs, 'domain' | 'level'>,
  skill: string | null,
  available: number,
): InsufficientQuestionSelection {
  return {
    ok: false,
    reason: 'insufficient-questions',
    domain: input.domain,
    skill,
    level: input.level,
    difficulty: levelToDifficulty(input.level),
    required: QUESTIONS_PER_SKILL,
    available,
  }
}

function uniqueQuestions(questions: readonly Question[]): Question[] {
  const unique = new Map<string, Question>()
  for (const question of questions) {
    if (!unique.has(question.id)) {
      unique.set(question.id, question)
    }
  }
  return [...unique.values()]
}

function seededOrder<T extends string>(items: readonly T[], seed: string): T[] {
  return [...items].sort((a, b) => {
    const difference = stableHash(`${seed}|${a}`) - stableHash(`${seed}|${b}`)
    return difference || a.localeCompare(b)
  })
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
