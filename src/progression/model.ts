import {
  DIFFICULTIES,
  LEVELS,
  SAT_DOMAINS,
  difficultyToLevel,
  levelRank,
  lowerLevel,
  type CharacterStage,
  type Difficulty,
  type Level,
  type SatDomain,
} from './config.ts'
import type { QuestionTaxonomy } from './questions.ts'

export const PROGRESSION_SCHEMA_VERSION = 1

export type SkillQuizPurpose = 'training' | 'checkpoint-repair'

export type SkillQuizAttempt = {
  timestamp: number
  level: Level
  score: number
  questionIds: string[]
  purpose: SkillQuizPurpose
}

export type SkillLevelProgress = {
  completed: boolean
  completedAt: number | null
  attempts: SkillQuizAttempt[]
  // Chronological, intentionally including repeats. The selector uses this to
  // prefer never/least-recently seen questions.
  questionIdHistory: string[]
}

export type SkillRemediation = {
  purpose: SkillQuizPurpose
  targetLevel: Level
  // The head is the only legal next quiz. A nested miss prepends another level.
  requiredPath: Level[]
}

export type SkillProgress = {
  levels: Record<Level, SkillLevelProgress>
  remediation: SkillRemediation | null
}

export type CheckpointAttempt = {
  timestamp: number
  level: 'Adventurer' | 'Master'
  score: number
  total: number
  questionIds: string[]
  missedSkills: string[]
}

export type CheckpointProgress = {
  passed: boolean
  passedAt: number | null
  attempts: CheckpointAttempt[]
  repairSkills: string[]
  repairedSkills: string[]
}

export type DiagnosticAttempt = {
  timestamp: number
  level: Level
  score: number
  total: number
  questionIds: string[]
}

export type DiagnosticProgress = {
  completedAt: number | null
  attempts: DiagnosticAttempt[]
}

export type DomainProgress = {
  entryLevel: Level
  unlockedLevel: Level
  diagnostic: DiagnosticProgress
  skills: Record<string, SkillProgress>
  checkpoints: Record<'Adventurer' | 'Master', CheckpointProgress>
  finished: boolean
  characterStage: CharacterStage
}

export type ProgressionState = {
  schemaVersion: typeof PROGRESSION_SCHEMA_VERSION
  onboarding: {
    results: Record<SatDomain, Difficulty>
    screenshotName: string | null
    confirmedAt: number
  }
  recommendationCandidates: SatDomain[]
  recommendedDomain: SatDomain | null
  selectedDomain: SatDomain | null
  domains: Record<SatDomain, DomainProgress>
  revision: number
}

export type SkillQuizSubmission = {
  domain: SatDomain
  skill: string
  level: Level
  score: number
  questionIds: string[]
  purpose: SkillQuizPurpose
  timestamp: number
}

export type CheckpointOutcome = {
  questionId: string
  skill: string
  correct: boolean
}

export type CheckpointSubmission = {
  domain: SatDomain
  level: 'Adventurer' | 'Master'
  outcomes: CheckpointOutcome[]
  timestamp: number
}

export type DiagnosticSubmission = {
  domain: SatDomain
  level: Level
  score: number
  total: number
  questionIds: string[]
  timestamp: number
}

export function weakestDomains(
  results: Record<SatDomain, Difficulty>,
): SatDomain[] {
  const minimum = Math.min(
    ...SAT_DOMAINS.map((domain) => levelRank(difficultyToLevel(results[domain]))),
  )
  return SAT_DOMAINS.filter(
    (domain) => levelRank(difficultyToLevel(results[domain])) === minimum,
  )
}

export function createProgressionState(
  results: Record<SatDomain, Difficulty>,
  taxonomy: QuestionTaxonomy,
  screenshotName: string | null = null,
  timestamp = Date.now(),
): ProgressionState {
  assertResults(results)
  const candidates = weakestDomains(results)
  const uniqueRecommendation = candidates.length === 1 ? candidates[0] : null
  const domains = {} as Record<SatDomain, DomainProgress>

  for (const domain of SAT_DOMAINS) {
    const entryLevel = difficultyToLevel(results[domain])
    domains[domain] = {
      entryLevel,
      unlockedLevel: entryLevel,
      diagnostic: emptyDiagnostic(),
      skills: Object.fromEntries(
        taxonomy[domain].map((skill) => [skill, emptySkillProgress()]),
      ),
      checkpoints: {
        Adventurer: emptyCheckpoint(),
        Master: emptyCheckpoint(),
      },
      finished: false,
      characterStage: entryLevel,
    }
  }

  return {
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    onboarding: {
      results: { ...results },
      screenshotName,
      confirmedAt: timestamp,
    },
    recommendationCandidates: candidates,
    recommendedDomain: uniqueRecommendation,
    selectedDomain: uniqueRecommendation,
    domains,
    revision: 0,
  }
}

export function submitDiagnostic(
  state: ProgressionState,
  submission: DiagnosticSubmission,
): ProgressionState {
  const domain = state.domains[submission.domain]
  const expectedTotal = Object.keys(domain.skills).length * 3
  if (
    domain.diagnostic.completedAt !== null ||
    submission.level !== domain.unlockedLevel ||
    submission.total !== expectedTotal ||
    submission.questionIds.length !== expectedTotal ||
    new Set(submission.questionIds).size !== expectedTotal ||
    !Number.isInteger(submission.score) ||
    submission.score < 0 ||
    submission.score > expectedTotal
  ) {
    throw new Error('Invalid domain diagnostic submission')
  }

  const next = cloneState(state)
  next.domains[submission.domain].diagnostic = {
    completedAt: submission.timestamp,
    attempts: [{
      timestamp: submission.timestamp,
      level: submission.level,
      score: submission.score,
      total: submission.total,
      questionIds: [...submission.questionIds],
    }],
  }
  next.revision += 1
  return next
}

export function selectActiveDomain(
  state: ProgressionState,
  domain: SatDomain,
): ProgressionState {
  if (!SAT_DOMAINS.includes(domain)) return state
  const next = cloneState(state)
  next.selectedDomain = domain
  if (
    next.recommendedDomain === null &&
    next.recommendationCandidates.includes(domain)
  ) {
    next.recommendedDomain = domain
  }
  next.revision += 1
  return next
}

export function getSkillPracticeLevel(
  state: ProgressionState,
  domain: SatDomain,
  skill: string,
): Level {
  const domainProgress = state.domains[domain]
  const skillProgress = domainProgress.skills[skill]
  if (!skillProgress) throw new Error(`Unknown skill: ${skill}`)
  return skillProgress.remediation?.requiredPath[0] ?? domainProgress.unlockedLevel
}

export function submitSkillQuiz(
  state: ProgressionState,
  submission: SkillQuizSubmission,
): ProgressionState {
  assertQuizSubmission(submission)
  const currentDomain = state.domains[submission.domain]
  const currentSkill = currentDomain.skills[submission.skill]
  if (!currentSkill) throw new Error(`Unknown skill: ${submission.skill}`)

  const expectedLevel =
    currentSkill.remediation?.requiredPath[0] ?? currentDomain.unlockedLevel
  if (submission.level !== expectedLevel) {
    throw new Error(`Expected ${expectedLevel} practice, received ${submission.level}`)
  }
  if (
    currentSkill.remediation &&
    currentSkill.remediation.purpose !== submission.purpose
  ) {
    throw new Error('Quiz purpose does not match active remediation')
  }

  const checkpointLevel =
    currentSkill.remediation?.purpose === 'checkpoint-repair'
      ? currentSkill.remediation.targetLevel
      : currentDomain.unlockedLevel
  const repairCheckpoint =
    checkpointLevel === 'Noobie' ? null : currentDomain.checkpoints[checkpointLevel]
  const isRequiredRepair =
    repairCheckpoint?.repairSkills.includes(submission.skill) ?? false

  if (submission.purpose === 'checkpoint-repair' && !isRequiredRepair) {
    throw new Error('This skill is not required for checkpoint repair')
  }
  if (submission.purpose === 'training' && isRequiredRepair) {
    throw new Error('Checkpoint repair must be completed before other practice')
  }

  const next = cloneState(state)
  const domain = next.domains[submission.domain]
  const skill = domain.skills[submission.skill]
  const levelProgress = skill.levels[submission.level]

  levelProgress.attempts.push({
    timestamp: submission.timestamp,
    level: submission.level,
    score: submission.score,
    questionIds: [...submission.questionIds],
    purpose: submission.purpose,
  })
  levelProgress.questionIdHistory.push(...submission.questionIds)

  if (submission.score === 3) {
    levelProgress.completed = true
    levelProgress.completedAt ??= submission.timestamp

    if (skill.remediation) {
      skill.remediation.requiredPath.shift()
      if (skill.remediation.requiredPath.length === 0) {
        const completedPurpose = skill.remediation.purpose
        const targetLevel = skill.remediation.targetLevel
        skill.remediation = null
        if (completedPurpose === 'checkpoint-repair' && targetLevel !== 'Noobie') {
          markCheckpointRepairComplete(
            domain.checkpoints[targetLevel],
            submission.skill,
          )
        }
      }
    } else if (submission.purpose === 'checkpoint-repair') {
      if (submission.level === 'Noobie') {
        throw new Error('Noobie has no checkpoint repair')
      }
      markCheckpointRepairComplete(
        domain.checkpoints[submission.level],
        submission.skill,
      )
    }

    if (
      submission.purpose === 'training' &&
      skill.remediation === null &&
      domain.unlockedLevel === 'Noobie' &&
      everySkillComplete(domain, 'Noobie')
    ) {
      domain.unlockedLevel = 'Adventurer'
    }
  } else {
    const lower = lowerLevel(submission.level)
    if (lower) {
      if (skill.remediation) {
        skill.remediation.requiredPath.unshift(lower)
      } else {
        skill.remediation = {
          purpose: submission.purpose,
          targetLevel: submission.level,
          requiredPath: [lower, submission.level],
        }
      }
    }
    // A Noobie miss simply leaves the same incomplete/required quiz at the
    // head. Its used IDs still ensure the next set is fresh when possible.
  }

  domain.characterStage = deriveCharacterStage(domain)
  next.revision += 1
  return next
}

export function canStartCheckpoint(
  state: ProgressionState,
  domainName: SatDomain,
  level: 'Adventurer' | 'Master',
): boolean {
  const domain = state.domains[domainName]
  if (
    domain.finished ||
    domain.unlockedLevel !== level ||
    domain.checkpoints[level].passed ||
    domain.checkpoints[level].repairSkills.length > 0
  ) {
    return false
  }
  return (
    everySkillComplete(domain, level) &&
    Object.values(domain.skills).every((skill) => skill.remediation === null)
  )
}

export function submitCheckpoint(
  state: ProgressionState,
  submission: CheckpointSubmission,
): ProgressionState {
  if (!canStartCheckpoint(state, submission.domain, submission.level)) {
    throw new Error('Checkpoint is locked')
  }

  const skills = Object.keys(state.domains[submission.domain].skills)
  const expectedTotal = skills.length * 3
  if (submission.outcomes.length !== expectedTotal) {
    throw new Error(`Checkpoint requires exactly ${expectedTotal} questions`)
  }
  if (new Set(submission.outcomes.map((outcome) => outcome.questionId)).size !== expectedTotal) {
    throw new Error('Checkpoint question IDs must be unique')
  }
  for (const skill of skills) {
    if (submission.outcomes.filter((outcome) => outcome.skill === skill).length !== 3) {
      throw new Error(`Checkpoint requires three questions for ${skill}`)
    }
  }
  if (submission.outcomes.some((outcome) => !skills.includes(outcome.skill))) {
    throw new Error('Checkpoint contains an unknown skill')
  }

  const next = cloneState(state)
  const domain = next.domains[submission.domain]
  const checkpoint = domain.checkpoints[submission.level]
  const missedSkills = skills.filter((skill) =>
    submission.outcomes.some((outcome) => outcome.skill === skill && !outcome.correct),
  )
  const questionIds = submission.outcomes.map((outcome) => outcome.questionId)
  const score = submission.outcomes.filter((outcome) => outcome.correct).length

  checkpoint.attempts.push({
    timestamp: submission.timestamp,
    level: submission.level,
    score,
    total: expectedTotal,
    questionIds,
    missedSkills,
  })

  for (const outcome of submission.outcomes) {
    domain.skills[outcome.skill].levels[submission.level].questionIdHistory.push(
      outcome.questionId,
    )
  }

  if (score === expectedTotal) {
    checkpoint.passed = true
    checkpoint.passedAt = submission.timestamp
    checkpoint.repairSkills = []
    checkpoint.repairedSkills = []
    if (submission.level === 'Adventurer') {
      domain.unlockedLevel = 'Master'
    } else {
      domain.finished = true
    }
  } else {
    checkpoint.repairSkills = missedSkills
    checkpoint.repairedSkills = []
  }

  domain.characterStage = deriveCharacterStage(domain)
  next.revision += 1
  return next
}

// Decode a stored document without inventing completion. Unknown skills are
// dropped, new bank skills are added empty, and gates/stages are recomputed.
export function normalizeProgression(
  value: unknown,
  taxonomy: QuestionTaxonomy,
): ProgressionState | null {
  if (!isRecord(value) || value.schemaVersion !== PROGRESSION_SCHEMA_VERSION) {
    return null
  }
  const onboarding = value.onboarding
  if (!isRecord(onboarding) || !isResults(onboarding.results)) return null

  const base = createProgressionState(
    onboarding.results,
    taxonomy,
    typeof onboarding.screenshotName === 'string' ? onboarding.screenshotName : null,
    typeof onboarding.confirmedAt === 'number' ? onboarding.confirmedAt : Date.now(),
  )
  const storedDomains = isRecord(value.domains) ? value.domains : {}

  for (const domainName of SAT_DOMAINS) {
    const storedDomain = storedDomains[domainName]
    if (!isRecord(storedDomain)) continue
    const domain = base.domains[domainName]
    domain.diagnostic = normalizeDiagnostic(
      storedDomain.diagnostic,
      taxonomy[domainName].length * 3,
      domain.entryLevel,
    )
    const storedSkills = isRecord(storedDomain.skills) ? storedDomain.skills : {}

    for (const skillName of taxonomy[domainName]) {
      const storedSkill = storedSkills[skillName]
      if (!isRecord(storedSkill)) continue
      const skill = domain.skills[skillName]
      const storedLevels = isRecord(storedSkill.levels) ? storedSkill.levels : {}

      for (const level of LEVELS) {
        const storedLevel = storedLevels[level]
        if (!isRecord(storedLevel)) continue
        skill.levels[level] = normalizeSkillLevel(storedLevel)
      }
      skill.remediation = normalizeRemediation(storedSkill.remediation)
    }

    const storedCheckpoints = isRecord(storedDomain.checkpoints)
      ? storedDomain.checkpoints
      : {}
    for (const level of ['Adventurer', 'Master'] as const) {
      domain.checkpoints[level] = normalizeCheckpoint(
        storedCheckpoints[level],
        taxonomy[domainName],
        level,
      )
    }

    domain.unlockedLevel = domain.entryLevel
    if (
      domain.entryLevel === 'Noobie' &&
      everySkillComplete(domain, 'Noobie')
    ) {
      domain.unlockedLevel = 'Adventurer'
    }
    if (
      levelRank(domain.entryLevel) <= levelRank('Adventurer') &&
      domain.checkpoints.Adventurer.passed
    ) {
      domain.unlockedLevel = 'Master'
    }
    domain.finished = domain.checkpoints.Master.passed
    if (domain.finished) {
      domain.unlockedLevel = 'Master'
    }

    // A repair can only belong to the checkpoint that is currently reachable.
    // Same-level repair has no SkillRemediation yet; a failed repair adds one.
    for (const level of ['Adventurer', 'Master'] as const) {
      if (level !== domain.unlockedLevel || domain.checkpoints[level].passed) {
        domain.checkpoints[level].repairSkills = []
      }
    }
    for (const skillName of taxonomy[domainName]) {
      const skill = domain.skills[skillName]
      skill.remediation = reconcileRemediation(
        skill.remediation,
        domain,
        skillName,
      )
    }

    domain.characterStage = deriveCharacterStage(domain)
  }

  const candidates = weakestDomains(base.onboarding.results)
  base.recommendationCandidates = candidates
  const recommended = value.recommendedDomain
  base.recommendedDomain =
    typeof recommended === 'string' &&
    SAT_DOMAINS.includes(recommended as SatDomain) &&
    candidates.includes(recommended as SatDomain)
      ? (recommended as SatDomain)
      : candidates.length === 1
        ? candidates[0]
        : null
  const selected = value.selectedDomain
  base.selectedDomain =
    typeof selected === 'string' && SAT_DOMAINS.includes(selected as SatDomain)
      ? (selected as SatDomain)
      : base.recommendedDomain
  base.revision = typeof value.revision === 'number' ? value.revision : 0
  return base
}

function emptySkillLevel(): SkillLevelProgress {
  return {
    completed: false,
    completedAt: null,
    attempts: [],
    questionIdHistory: [],
  }
}

function emptySkillProgress(): SkillProgress {
  return {
    levels: {
      Noobie: emptySkillLevel(),
      Adventurer: emptySkillLevel(),
      Master: emptySkillLevel(),
    },
    remediation: null,
  }
}

function emptyCheckpoint(): CheckpointProgress {
  return {
    passed: false,
    passedAt: null,
    attempts: [],
    repairSkills: [],
    repairedSkills: [],
  }
}

function emptyDiagnostic(): DiagnosticProgress {
  return { completedAt: null, attempts: [] }
}

function normalizeDiagnostic(
  value: unknown,
  expectedTotal: number,
  entryLevel: Level,
): DiagnosticProgress {
  if (!isRecord(value) || !Array.isArray(value.attempts)) return emptyDiagnostic()
  const attempts = value.attempts.filter((attempt): attempt is DiagnosticAttempt => {
    if (!isRecord(attempt)) return false
    const ids = Array.isArray(attempt.questionIds) ? attempt.questionIds : []
    return (
      typeof attempt.timestamp === 'number' &&
      attempt.level === entryLevel &&
      attempt.total === expectedTotal &&
      typeof attempt.score === 'number' &&
      Number.isInteger(attempt.score) &&
      attempt.score >= 0 &&
      attempt.score <= expectedTotal &&
      ids.length === expectedTotal &&
      ids.every((id) => typeof id === 'string') &&
      new Set(ids).size === expectedTotal
    )
  })
  return attempts.length > 0
    ? { completedAt: attempts[0].timestamp, attempts: [attempts[0]] }
    : emptyDiagnostic()
}

function everySkillComplete(domain: DomainProgress, level: Level): boolean {
  const skills = Object.values(domain.skills)
  return skills.length > 0 && skills.every((skill) => skill.levels[level].completed)
}

function deriveCharacterStage(domain: DomainProgress): CharacterStage {
  return domain.finished ? 'Completed' : domain.unlockedLevel
}

function markCheckpointRepairComplete(
  checkpoint: CheckpointProgress,
  skill: string,
): void {
  checkpoint.repairSkills = checkpoint.repairSkills.filter(
    (item) => item !== skill,
  )
  if (!checkpoint.repairedSkills.includes(skill)) {
    checkpoint.repairedSkills.push(skill)
  }
}

function assertResults(results: Record<SatDomain, Difficulty>): void {
  for (const domain of SAT_DOMAINS) {
    if (!DIFFICULTIES.includes(results[domain])) {
      throw new Error(`Missing result for ${domain}`)
    }
  }
}

function assertQuizSubmission(submission: SkillQuizSubmission): void {
  if (
    !Number.isInteger(submission.score) ||
    submission.score < 0 ||
    submission.score > 3
  ) {
    throw new Error('Skill score must be between 0 and 3')
  }
  if (
    submission.questionIds.length !== 3 ||
    new Set(submission.questionIds).size !== 3
  ) {
    throw new Error('A skill quiz requires three distinct questions')
  }
}

function cloneState(state: ProgressionState): ProgressionState {
  return JSON.parse(JSON.stringify(state)) as ProgressionState
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isResults(value: unknown): value is Record<SatDomain, Difficulty> {
  if (!isRecord(value)) return false
  return SAT_DOMAINS.every((domain) =>
    DIFFICULTIES.includes(value[domain] as Difficulty),
  )
}

function normalizeSkillLevel(value: Record<string, unknown>): SkillLevelProgress {
  const attempts = Array.isArray(value.attempts)
    ? value.attempts.filter(isSkillAttempt).map((attempt) => ({
        ...attempt,
        questionIds: [...attempt.questionIds],
      }))
    : []
  const storedHistory = Array.isArray(value.questionIdHistory)
    ? value.questionIdHistory.filter((item): item is string => typeof item === 'string')
    : attempts.flatMap((attempt) => attempt.questionIds)
  return {
    completed: value.completed === true,
    completedAt: typeof value.completedAt === 'number' ? value.completedAt : null,
    attempts,
    questionIdHistory: storedHistory,
  }
}

function isSkillAttempt(value: unknown): value is SkillQuizAttempt {
  return (
    isRecord(value) &&
    typeof value.timestamp === 'number' &&
    LEVELS.includes(value.level as Level) &&
    typeof value.score === 'number' &&
    Array.isArray(value.questionIds) &&
    value.questionIds.every((item) => typeof item === 'string') &&
    (value.purpose === 'training' || value.purpose === 'checkpoint-repair')
  )
}

function normalizeRemediation(value: unknown): SkillRemediation | null {
  if (
    !isRecord(value) ||
    (value.purpose !== 'training' && value.purpose !== 'checkpoint-repair') ||
    !LEVELS.includes(value.targetLevel as Level) ||
    !Array.isArray(value.requiredPath)
  ) {
    return null
  }
  if (
    !value.requiredPath.every((level) => LEVELS.includes(level as Level))
  ) {
    return null
  }
  const path = value.requiredPath as Level[]
  const targetLevel = value.targetLevel as Level
  if (
    path.length === 0 ||
    path.at(-1) !== targetLevel ||
    path.some(
      (level, index) =>
        index > 0 && levelRank(level) !== levelRank(path[index - 1]) + 1,
    ) ||
    (value.purpose === 'checkpoint-repair' && targetLevel === 'Noobie')
  ) {
    return null
  }
  return {
    purpose: value.purpose,
    targetLevel,
    requiredPath: path,
  }
}

function reconcileRemediation(
  remediation: SkillRemediation | null,
  domain: DomainProgress,
  skill: string,
): SkillRemediation | null {
  if (!remediation || remediation.targetLevel !== domain.unlockedLevel) {
    return null
  }

  const repairLevels = (['Adventurer', 'Master'] as const).filter((level) =>
    domain.checkpoints[level].repairSkills.includes(skill),
  )
  if (remediation.purpose === 'checkpoint-repair') {
    return remediation.targetLevel !== 'Noobie' &&
      repairLevels.length === 1 &&
      repairLevels[0] === remediation.targetLevel
      ? remediation
      : null
  }

  // A checkpoint repair is the authoritative gate. Do not retain a conflicting
  // training remediation that submitSkillQuiz would reject after the quiz.
  return repairLevels.length === 0 ? remediation : null
}

function normalizeCheckpoint(
  value: unknown,
  skills: string[],
  level: 'Adventurer' | 'Master',
): CheckpointProgress {
  if (!isRecord(value)) return emptyCheckpoint()
  const expectedTotal = skills.length * 3
  const attempts = Array.isArray(value.attempts)
    ? value.attempts.filter((attempt): attempt is CheckpointAttempt => {
        if (!isRecord(attempt)) return false
        const questionIds = Array.isArray(attempt.questionIds)
          ? attempt.questionIds
          : []
        const missedSkills = Array.isArray(attempt.missedSkills)
          ? attempt.missedSkills
          : []
        const timestamp = attempt.timestamp
        const score = attempt.score
        return (
          expectedTotal > 0 &&
          attempt.level === level &&
          typeof timestamp === 'number' &&
          Number.isFinite(timestamp) &&
          typeof score === 'number' &&
          Number.isInteger(score) &&
          score >= 0 &&
          score <= expectedTotal &&
          attempt.total === expectedTotal &&
          questionIds.length === expectedTotal &&
          questionIds.every(
            (item) => typeof item === 'string' && item.length > 0,
          ) &&
          new Set(questionIds).size === expectedTotal &&
          missedSkills.every(
            (item) => typeof item === 'string' && skills.includes(item),
          ) &&
          new Set(missedSkills).size === missedSkills.length &&
          (score === expectedTotal
            ? missedSkills.length === 0
            : missedSkills.length > 0)
        )
      })
    : []
  const known = (items: unknown) => {
    const values =
      Array.isArray(items)
        ? items.filter((item): item is string =>
            typeof item === 'string' && skills.includes(item),
          )
        : []
    return [...new Set(values)]
  }
  const perfectAttempt = attempts.find(
    (attempt) =>
      attempt.score === expectedTotal &&
      attempt.total === expectedTotal &&
      attempt.missedSkills.length === 0,
  )
  const passed = value.passed === true && perfectAttempt !== undefined
  return {
    passed,
    passedAt: passed ? perfectAttempt.timestamp : null,
    attempts,
    repairSkills: passed ? [] : known(value.repairSkills),
    repairedSkills: known(value.repairedSkills),
  }
}
