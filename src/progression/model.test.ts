import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  difficultyToLevel,
  type Difficulty,
  type SatDomain,
} from './config.ts'
import {
  canStartCheckpoint,
  createProgressionState,
  getSkillPracticeLevel,
  normalizeProgression,
  submitCheckpoint,
  submitSkillQuiz,
  weakestDomains,
  type CheckpointOutcome,
  type ProgressionState,
  type SkillQuizPurpose,
} from './model.ts'
import type { QuestionTaxonomy } from './questions.ts'

const INFO: SatDomain = 'Information and Ideas'
const CRAFT: SatDomain = 'Craft and Structure'
const EXPRESSION: SatDomain = 'Expression of Ideas'
const CONVENTIONS: SatDomain = 'Standard English Conventions'

const TAXONOMY: QuestionTaxonomy = {
  [INFO]: ['Evidence', 'Inferences'],
  [CRAFT]: ['Words'],
  [EXPRESSION]: ['Transitions'],
  [CONVENTIONS]: ['Boundaries'],
}

function results(
  overrides: Partial<Record<SatDomain, Difficulty>> = {},
): Record<SatDomain, Difficulty> {
  const defaults: Record<SatDomain, Difficulty> = {
    'Information and Ideas': 'Easy',
    'Craft and Structure': 'Easy',
    'Expression of Ideas': 'Easy',
    'Standard English Conventions': 'Easy',
  }
  return Object.assign(defaults, overrides)
}

let quizOrdinal = 0

function takeQuiz(
  state: ProgressionState,
  {
    domain = INFO,
    skill = 'Evidence',
    level = getSkillPracticeLevel(state, domain, skill),
    score = 3,
    purpose = 'training',
  }: {
    domain?: SatDomain
    skill?: string
    level?: 'Noobie' | 'Adventurer' | 'Master'
    score?: number
    purpose?: SkillQuizPurpose
  } = {},
): ProgressionState {
  quizOrdinal += 1
  return submitSkillQuiz(state, {
    domain,
    skill,
    level,
    score,
    purpose,
    timestamp: quizOrdinal,
    questionIds: [
      `q-${quizOrdinal}-1`,
      `q-${quizOrdinal}-2`,
      `q-${quizOrdinal}-3`,
    ],
  })
}

function completeLevel(
  state: ProgressionState,
  domain: SatDomain,
  level: 'Noobie' | 'Adventurer' | 'Master',
): ProgressionState {
  let next = state
  for (const skill of Object.keys(next.domains[domain].skills)) {
    next = takeQuiz(next, { domain, skill, level, score: 3 })
  }
  return next
}

function checkpointOutcomes(
  state: ProgressionState,
  domain: SatDomain,
  missedSkills: string[] = [],
): CheckpointOutcome[] {
  quizOrdinal += 1
  return Object.keys(state.domains[domain].skills).flatMap((skill) =>
    [0, 1, 2].map((index) => ({
      questionId: `cp-${quizOrdinal}-${skill}-${index}`,
      skill,
      correct: !(missedSkills.includes(skill) && index === 0),
    })),
  )
}

describe('progression model', () => {
  it('maps College Board difficulties to product levels', () => {
    assert.equal(difficultyToLevel('Easy'), 'Noobie')
    assert.equal(difficultyToLevel('Medium'), 'Adventurer')
    assert.equal(difficultyToLevel('Hard'), 'Master')
  })

  it('finds a unique weakest domain and every member of a tie', () => {
    const unique = results({
      [INFO]: 'Easy',
      [CRAFT]: 'Medium',
      [EXPRESSION]: 'Hard',
      [CONVENTIONS]: 'Medium',
    })
    assert.deepEqual(weakestDomains(unique), [INFO])

    const tied = results({
      [INFO]: 'Easy',
      [CRAFT]: 'Medium',
      [EXPRESSION]: 'Easy',
      [CONVENTIONS]: 'Hard',
    })
    assert.deepEqual(weakestDomains(tied), [INFO, EXPRESSION])

    const state = createProgressionState(tied, TAXONOMY)
    assert.deepEqual(state.recommendationCandidates, [INFO, EXPRESSION])
    assert.equal(state.recommendedDomain, null)
    assert.equal(state.selectedDomain, null)
  })

  it('starts each domain directly at its confirmed level', () => {
    const state = createProgressionState(
      results({
        [INFO]: 'Easy',
        [CRAFT]: 'Medium',
        [EXPRESSION]: 'Hard',
        [CONVENTIONS]: 'Hard',
      }),
      TAXONOMY,
    )
    assert.equal(state.domains[INFO].entryLevel, 'Noobie')
    assert.equal(state.domains[INFO].unlockedLevel, 'Noobie')
    assert.equal(state.domains[CRAFT].unlockedLevel, 'Adventurer')
    assert.equal(state.domains[EXPRESSION].unlockedLevel, 'Master')
    assert.equal(state.domains[CONVENTIONS].characterStage, 'Master')
  })

  it('marks a skill complete only on 3/3 and preserves its question history', () => {
    const initial = createProgressionState(results(), TAXONOMY)
    const next = takeQuiz(initial, { score: 3 })
    const progress = next.domains[INFO].skills.Evidence.levels.Noobie

    assert.equal(progress.completed, true)
    assert.equal(progress.completedAt, 1)
    assert.equal(progress.attempts.length, 1)
    assert.deepEqual(progress.questionIdHistory, ['q-1-1', 'q-1-2', 'q-1-3'])
    assert.equal(initial.domains[INFO].skills.Evidence.levels.Noobie.completed, false)
  })

  it('moves a 1/3 Adventurer skill down to Noobie', () => {
    const initial = createProgressionState(
      results({ [INFO]: 'Medium' }),
      TAXONOMY,
    )
    const next = takeQuiz(initial, { level: 'Adventurer', score: 1 })

    assert.deepEqual(next.domains[INFO].skills.Evidence.remediation, {
      purpose: 'training',
      targetLevel: 'Adventurer',
      requiredPath: ['Noobie', 'Adventurer'],
    })
    assert.equal(getSkillPracticeLevel(next, INFO, 'Evidence'), 'Noobie')
  })

  it('moves a 2/3 Master skill down to Adventurer', () => {
    const initial = createProgressionState(
      results({ [INFO]: 'Hard' }),
      TAXONOMY,
    )
    const next = takeQuiz(initial, { level: 'Master', score: 2 })

    assert.deepEqual(
      next.domains[INFO].skills.Evidence.remediation?.requiredPath,
      ['Adventurer', 'Master'],
    )
  })

  it('supports nested remediation and requires returning through every level', () => {
    let state = createProgressionState(results({ [INFO]: 'Hard' }), TAXONOMY)
    state = takeQuiz(state, { level: 'Master', score: 2 })
    state = takeQuiz(state, { level: 'Adventurer', score: 1 })
    assert.deepEqual(
      state.domains[INFO].skills.Evidence.remediation?.requiredPath,
      ['Noobie', 'Adventurer', 'Master'],
    )

    state = takeQuiz(state, { level: 'Noobie', score: 3 })
    assert.equal(getSkillPracticeLevel(state, INFO, 'Evidence'), 'Adventurer')
    state = takeQuiz(state, { level: 'Adventurer', score: 3 })
    assert.equal(getSkillPracticeLevel(state, INFO, 'Evidence'), 'Master')
    state = takeQuiz(state, { level: 'Master', score: 3 })

    assert.equal(state.domains[INFO].skills.Evidence.remediation, null)
    assert.equal(
      state.domains[INFO].skills.Evidence.levels.Master.completed,
      true,
    )
  })

  it('guards a checkpoint until every skill at its level is complete', () => {
    let state = createProgressionState(
      results({ [INFO]: 'Medium' }),
      TAXONOMY,
    )
    assert.equal(canStartCheckpoint(state, INFO, 'Adventurer'), false)
    state = takeQuiz(state, {
      skill: 'Evidence',
      level: 'Adventurer',
      score: 3,
    })
    assert.equal(canStartCheckpoint(state, INFO, 'Adventurer'), false)
    assert.throws(
      () =>
        submitCheckpoint(state, {
          domain: INFO,
          level: 'Adventurer',
          outcomes: checkpointOutcomes(state, INFO),
          timestamp: 20,
        }),
      /locked/,
    )
    state = takeQuiz(state, {
      skill: 'Inferences',
      level: 'Adventurer',
      score: 3,
    })
    assert.equal(canStartCheckpoint(state, INFO, 'Adventurer'), true)
  })

  it('requires 100%, repairs only missed skills, and locks the retake', () => {
    let state = createProgressionState(
      results({ [INFO]: 'Medium' }),
      TAXONOMY,
    )
    state = completeLevel(state, INFO, 'Adventurer')
    state = submitCheckpoint(state, {
      domain: INFO,
      level: 'Adventurer',
      outcomes: checkpointOutcomes(state, INFO, ['Evidence']),
      timestamp: 30,
    })

    const checkpoint = state.domains[INFO].checkpoints.Adventurer
    assert.equal(checkpoint.passed, false)
    assert.equal(checkpoint.attempts[0].score, 5)
    assert.equal(checkpoint.attempts[0].total, 6)
    assert.deepEqual(checkpoint.repairSkills, ['Evidence'])
    assert.equal(state.domains[INFO].skills.Inferences.remediation, null)
    assert.equal(canStartCheckpoint(state, INFO, 'Adventurer'), false)
  })

  it('keeps a failed repair locked until lower work and a same-level 3/3 pass', () => {
    let state = createProgressionState(
      results({ [INFO]: 'Medium' }),
      TAXONOMY,
    )
    state = completeLevel(state, INFO, 'Adventurer')
    state = submitCheckpoint(state, {
      domain: INFO,
      level: 'Adventurer',
      outcomes: checkpointOutcomes(state, INFO, ['Evidence']),
      timestamp: 40,
    })

    state = takeQuiz(state, {
      level: 'Adventurer',
      score: 2,
      purpose: 'checkpoint-repair',
    })
    assert.deepEqual(
      state.domains[INFO].skills.Evidence.remediation?.requiredPath,
      ['Noobie', 'Adventurer'],
    )
    assert.equal(canStartCheckpoint(state, INFO, 'Adventurer'), false)

    state = takeQuiz(state, {
      level: 'Noobie',
      score: 3,
      purpose: 'checkpoint-repair',
    })
    assert.equal(canStartCheckpoint(state, INFO, 'Adventurer'), false)
    assert.deepEqual(
      state.domains[INFO].checkpoints.Adventurer.repairSkills,
      ['Evidence'],
    )

    state = takeQuiz(state, {
      level: 'Adventurer',
      score: 3,
      purpose: 'checkpoint-repair',
    })
    assert.deepEqual(
      state.domains[INFO].checkpoints.Adventurer.repairSkills,
      [],
    )
    assert.equal(canStartCheckpoint(state, INFO, 'Adventurer'), true)
  })

  it('passes an Adventurer checkpoint only at 100% and unlocks Master', () => {
    let state = createProgressionState(
      results({ [INFO]: 'Medium' }),
      TAXONOMY,
    )
    state = completeLevel(state, INFO, 'Adventurer')
    state = submitCheckpoint(state, {
      domain: INFO,
      level: 'Adventurer',
      outcomes: checkpointOutcomes(state, INFO),
      timestamp: 50,
    })

    assert.equal(state.domains[INFO].checkpoints.Adventurer.passed, true)
    assert.equal(state.domains[INFO].unlockedLevel, 'Master')
    assert.equal(state.domains[INFO].characterStage, 'Master')
  })

  it('finishes a domain only after a perfect Master checkpoint', () => {
    let state = createProgressionState(results({ [INFO]: 'Hard' }), TAXONOMY)
    state = completeLevel(state, INFO, 'Master')
    state = submitCheckpoint(state, {
      domain: INFO,
      level: 'Master',
      outcomes: checkpointOutcomes(state, INFO),
      timestamp: 60,
    })

    assert.equal(state.domains[INFO].checkpoints.Master.passed, true)
    assert.equal(state.domains[INFO].finished, true)
    assert.equal(state.domains[INFO].characterStage, 'Completed')
  })

  it('normalizes taxonomy changes and recomputes derived character state', () => {
    let state = createProgressionState(results(), TAXONOMY)
    state = takeQuiz(state, { skill: 'Evidence', score: 3 })
    const raw = JSON.parse(JSON.stringify(state)) as ProgressionState
    raw.domains[INFO].characterStage = 'Completed'
    raw.domains[INFO].skills.Obsolete = raw.domains[INFO].skills.Inferences

    const changedTaxonomy: QuestionTaxonomy = {
      ...TAXONOMY,
      [INFO]: ['Evidence', 'New Skill'],
    }
    const normalized = normalizeProgression(raw, changedTaxonomy)

    assert.ok(normalized)
    assert.equal(
      normalized.domains[INFO].skills.Evidence.levels.Noobie.completed,
      true,
    )
    assert.equal(normalized.domains[INFO].skills['New Skill'].levels.Noobie.completed, false)
    assert.equal('Obsolete' in normalized.domains[INFO].skills, false)
    assert.equal(normalized.domains[INFO].characterStage, 'Noobie')
  })

  it('drops malformed or orphaned remediation while preserving a valid checkpoint repair', () => {
    const initial = createProgressionState(
      results({ [INFO]: 'Medium' }),
      TAXONOMY,
    )

    const malformed = JSON.parse(JSON.stringify(initial)) as ProgressionState
    malformed.domains[INFO].skills.Evidence.remediation = {
      purpose: 'checkpoint-repair',
      targetLevel: 'Noobie',
      requiredPath: ['Noobie'],
    }
    malformed.domains[INFO].checkpoints.Adventurer.repairSkills = ['Evidence']
    const normalizedMalformed = normalizeProgression(malformed, TAXONOMY)
    assert.ok(normalizedMalformed)
    assert.equal(
      normalizedMalformed.domains[INFO].skills.Evidence.remediation,
      null,
    )
    // The checkpoint remains authoritative and offers a fresh same-level repair.
    assert.deepEqual(
      normalizedMalformed.domains[INFO].checkpoints.Adventurer.repairSkills,
      ['Evidence'],
    )

    const orphaned = JSON.parse(JSON.stringify(initial)) as ProgressionState
    orphaned.domains[INFO].skills.Evidence.remediation = {
      purpose: 'checkpoint-repair',
      targetLevel: 'Adventurer',
      requiredPath: ['Noobie', 'Adventurer'],
    }
    const normalizedOrphaned = normalizeProgression(orphaned, TAXONOMY)
    assert.ok(normalizedOrphaned)
    assert.equal(
      normalizedOrphaned.domains[INFO].skills.Evidence.remediation,
      null,
    )

    const brokenPath = createProgressionState(
      results({ [INFO]: 'Hard' }),
      TAXONOMY,
    )
    brokenPath.domains[INFO].skills.Evidence.remediation = {
      purpose: 'training',
      targetLevel: 'Master',
      requiredPath: ['Noobie', 'Master'],
    }
    const normalizedBrokenPath = normalizeProgression(brokenPath, TAXONOMY)
    assert.ok(normalizedBrokenPath)
    assert.equal(
      normalizedBrokenPath.domains[INFO].skills.Evidence.remediation,
      null,
    )

    const valid = JSON.parse(JSON.stringify(initial)) as ProgressionState
    valid.domains[INFO].checkpoints.Adventurer.repairSkills = ['Evidence']
    valid.domains[INFO].skills.Evidence.remediation = {
      purpose: 'checkpoint-repair',
      targetLevel: 'Adventurer',
      requiredPath: ['Noobie', 'Adventurer'],
    }
    const normalizedValid = normalizeProgression(valid, TAXONOMY)
    assert.ok(normalizedValid)
    assert.deepEqual(
      normalizedValid.domains[INFO].skills.Evidence.remediation,
      valid.domains[INFO].skills.Evidence.remediation,
    )
  })

  it('rejects a persisted checkpoint pass without a valid perfect attempt', () => {
    const initial = createProgressionState(
      results({ [INFO]: 'Hard' }),
      TAXONOMY,
    )
    const raw = JSON.parse(JSON.stringify(initial)) as ProgressionState
    raw.domains[INFO].checkpoints.Master.passed = true
    raw.domains[INFO].checkpoints.Master.passedAt = 100
    raw.domains[INFO].checkpoints.Master.attempts.push({
      timestamp: 100,
      level: 'Master',
      score: 3,
      total: 3,
      questionIds: ['short-1', 'short-2', 'short-3'],
      missedSkills: [],
    })

    const normalized = normalizeProgression(raw, TAXONOMY)
    assert.ok(normalized)
    assert.equal(normalized.domains[INFO].checkpoints.Master.passed, false)
    assert.equal(normalized.domains[INFO].checkpoints.Master.passedAt, null)
    assert.equal(normalized.domains[INFO].checkpoints.Master.attempts.length, 0)
    assert.equal(normalized.domains[INFO].finished, false)
    assert.equal(normalized.domains[INFO].characterStage, 'Master')
  })

  it('normalizes a persisted Master pass to a consistent completed domain', () => {
    const state = createProgressionState(
      results({ [INFO]: 'Hard' }),
      TAXONOMY,
    )
    const raw = JSON.parse(JSON.stringify(state)) as ProgressionState
    raw.domains[INFO].checkpoints.Master.passed = true
    raw.domains[INFO].checkpoints.Master.passedAt = 100
    raw.domains[INFO].checkpoints.Master.attempts.push({
      timestamp: 100,
      level: 'Master',
      score: 6,
      total: 6,
      questionIds: [
        'master-1',
        'master-2',
        'master-3',
        'master-4',
        'master-5',
        'master-6',
      ],
      missedSkills: [],
    })

    const normalized = normalizeProgression(raw, TAXONOMY)
    assert.ok(normalized)
    assert.equal(normalized.domains[INFO].finished, true)
    assert.equal(normalized.domains[INFO].unlockedLevel, 'Master')
    assert.equal(normalized.domains[INFO].characterStage, 'Completed')
  })
})
