import {
  DIFFICULTIES,
  SAT_DOMAINS,
  type Difficulty,
  type SatDomain,
} from '../progression/config.ts'
import type { Attempt, Question } from '../types.ts'

// A drill is the student's own set: they name the target (domain, skill,
// difficulty), the length, and the clock, and Clarity hands back that many
// questions from the bank. Nothing here touches the study path - a drill is a
// side door into the same bank, and every miss files into the same vault.

export const MIXED_DOMAIN = 'mixed'
export const ALL_SKILLS = 'all'
export const ANY_DIFFICULTY = 'any'

export type DrillDomain = SatDomain | typeof MIXED_DOMAIN
export type DrillDifficulty = Difficulty | typeof ANY_DIFFICULTY

export const DRILL_COUNTS = [5, 10, 15, 20, 30] as const
/** Seconds per question. null is the untimed run. */
export const DRILL_CLOCKS = [45, 60, 90, 120] as const

export type DrillSetup = {
  domain: DrillDomain
  /** A skill name, or ALL_SKILLS for every skill in the chosen domain. */
  skill: string
  difficulty: DrillDifficulty
  count: number
  /** null runs the drill without a clock. */
  secondsPerQuestion: number | null
}

export const DEFAULT_DRILL_SETUP: DrillSetup = {
  domain: MIXED_DOMAIN,
  skill: ALL_SKILLS,
  difficulty: ANY_DIFFICULTY,
  count: 10,
  secondsPerQuestion: 90,
}

function isDomain(value: unknown): value is DrillDomain {
  return value === MIXED_DOMAIN || SAT_DOMAINS.includes(value as SatDomain)
}

function isDifficulty(value: unknown): value is DrillDifficulty {
  return value === ANY_DIFFICULTY || DIFFICULTIES.includes(value as Difficulty)
}

/** Restore a persisted setup, dropping anything the current bank can't honour. */
export function normalizeDrillSetup(value: unknown): DrillSetup {
  if (!value || typeof value !== 'object') return DEFAULT_DRILL_SETUP
  const raw = value as Partial<DrillSetup>
  const domain = isDomain(raw.domain) ? raw.domain : DEFAULT_DRILL_SETUP.domain
  const clock =
    raw.secondsPerQuestion === null
      ? null
      : DRILL_CLOCKS.includes(raw.secondsPerQuestion as (typeof DRILL_CLOCKS)[number])
        ? (raw.secondsPerQuestion as number)
        : DEFAULT_DRILL_SETUP.secondsPerQuestion
  return {
    domain,
    // A skill only means something inside one domain.
    skill:
      domain !== MIXED_DOMAIN && typeof raw.skill === 'string' && raw.skill
        ? raw.skill
        : ALL_SKILLS,
    difficulty: isDifficulty(raw.difficulty) ? raw.difficulty : DEFAULT_DRILL_SETUP.difficulty,
    count: DRILL_COUNTS.includes(raw.count as (typeof DRILL_COUNTS)[number])
      ? (raw.count as number)
      : DEFAULT_DRILL_SETUP.count,
    secondsPerQuestion: clock,
  }
}

/** Switching domain drops a skill that belongs to the domain you just left. */
export function withDomain(setup: DrillSetup, domain: DrillDomain): DrillSetup {
  return { ...setup, domain, skill: ALL_SKILLS }
}

export function matchesDrill(question: Question, setup: DrillSetup): boolean {
  if (setup.domain !== MIXED_DOMAIN && question.domain !== setup.domain) return false
  if (setup.skill !== ALL_SKILLS && question.skill !== setup.skill) return false
  if (setup.difficulty !== ANY_DIFFICULTY && question.difficulty !== setup.difficulty) return false
  return true
}

/** Everything in the bank that matches the target, before the length is applied. */
export function drillPool(questions: readonly Question[], setup: DrillSetup): Question[] {
  return questions.filter((question) => matchesDrill(question, setup))
}

/** The skills a domain actually has questions for, in bank order. */
export function drillSkills(
  questions: readonly Question[],
  domain: DrillDomain,
): string[] {
  if (domain === MIXED_DOMAIN) return []
  const seen: string[] = []
  for (const question of questions) {
    if (question.domain !== domain) continue
    if (!seen.includes(question.skill)) seen.push(question.skill)
  }
  return seen
}

/** The last time each question was answered, for freshness ordering. */
export function lastSeenAt(attempts: readonly Attempt[]): Record<string, number> {
  const seen: Record<string, number> = {}
  for (const attempt of attempts) {
    const previous = seen[attempt.questionId] ?? 0
    if (attempt.timestamp > previous) seen[attempt.questionId] = attempt.timestamp
  }
  return seen
}

function seededKey(id: string, seed: number): number {
  let hash = 2166136261 ^ seed
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

type DrillSelectionOptions = {
  /** questionId -> last attempt timestamp. Anything missing has never been seen. */
  seen?: Record<string, number>
  /** Changing the seed reshuffles a repeated drill on the same target. */
  seed?: number
}

// Never-answered questions come first, then the ones you saw longest ago, and
// the shuffle only breaks ties. A repeated drill on the same target therefore
// works through the bank instead of handing back the same ten questions.
export function selectDrillQuestions(
  questions: readonly Question[],
  setup: DrillSetup,
  { seen = {}, seed = 0 }: DrillSelectionOptions = {},
): Question[] {
  return drillPool(questions, setup)
    .map((question) => ({
      question,
      seenAt: seen[question.id] ?? 0,
      tiebreak: seededKey(question.id, seed),
    }))
    .sort((left, right) =>
      left.seenAt === right.seenAt
        ? left.tiebreak - right.tiebreak
        : left.seenAt - right.seenAt,
    )
    .slice(0, setup.count)
    .map((entry) => entry.question)
}

export function drillTargetLabel(setup: DrillSetup): string {
  const parts: string[] = [
    setup.domain === MIXED_DOMAIN ? 'Every domain' : setup.domain,
  ]
  if (setup.skill !== ALL_SKILLS) parts.push(setup.skill)
  parts.push(setup.difficulty === ANY_DIFFICULTY ? 'any difficulty' : setup.difficulty)
  return parts.join(' · ')
}
