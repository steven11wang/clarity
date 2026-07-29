import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Question } from '../types.ts'
import {
  createAdaptiveDraft,
  restoreAdaptiveDraft,
  type AdaptiveAssessment,
} from './assessmentDraft.ts'
import type { Difficulty, SatDomain } from './config.ts'
import {
  createProgressionState,
  submitSkillQuiz,
  type ProgressionState,
} from './model.ts'
import type { QuestionTaxonomy } from './questions.ts'

const INFO: SatDomain = 'Information and Ideas'
const SKILL = 'Inferences'
const TAXONOMY: QuestionTaxonomy = {
  'Information and Ideas': [SKILL],
  'Craft and Structure': ['Words in Context'],
  'Expression of Ideas': ['Transitions'],
  'Standard English Conventions': ['Boundaries'],
}

function results(): Record<SatDomain, Difficulty> {
  return {
    'Information and Ideas': 'Medium',
    'Craft and Structure': 'Easy',
    'Expression of Ideas': 'Easy',
    'Standard English Conventions': 'Easy',
  }
}

function question(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    assessment: 'SAT',
    test: 'Reading and Writing',
    domain: INFO,
    skill: SKILL,
    difficulty: 'Medium',
    passage: `Passage for ${id}.`,
    prompt: `Prompt for ${id}?`,
    choices: {
      A: 'Choice A',
      B: 'Choice B',
      C: 'Choice C',
      D: 'Choice D',
    },
    answer: 'A',
    rationale: 'Rationale.',
    ...overrides,
  }
}

function initialState(): ProgressionState {
  return createProgressionState(results(), TAXONOMY, null, 123)
}

function skillAssessment(questions: Question[]): AdaptiveAssessment {
  return {
    kind: 'skill',
    id: `skill:${INFO}:${SKILL}:Adventurer:0`,
    domain: INFO,
    skill: SKILL,
    level: 'Adventurer',
    purpose: 'training',
    questions,
    reusedCount: 1,
  }
}

describe('adaptive assessment draft', () => {
  it('restores the same skill questions and valid partial answers', () => {
    const questions = [question('q1'), question('q2'), question('q3')]
    const state = initialState()
    const draft = createAdaptiveDraft(
      skillAssessment(questions),
      { q1: 'B', q2: 'D' },
      state.onboarding.confirmedAt,
    )

    const restored = restoreAdaptiveDraft(draft, questions, state, TAXONOMY)

    assert.ok(restored)
    assert.equal(restored.assessment.kind, 'skill')
    assert.deepEqual(
      restored.assessment.questions.map((item) => item.id),
      ['q1', 'q2', 'q3'],
    )
    assert.deepEqual(restored.answers, { q1: 'B', q2: 'D' })
  })

  it('rejects stale onboarding and assessment attempt identities', () => {
    const questions = [question('q1'), question('q2'), question('q3')]
    const state = initialState()
    const draft = createAdaptiveDraft(
      skillAssessment(questions),
      {},
      state.onboarding.confirmedAt,
    )

    assert.equal(
      restoreAdaptiveDraft(
        { ...draft, progressionConfirmedAt: 999 },
        questions,
        state,
        TAXONOMY,
      ),
      null,
    )
    assert.equal(
      restoreAdaptiveDraft(
        {
          ...draft,
          assessment: { ...draft.assessment, id: `${draft.assessment.id}:stale` },
        },
        questions,
        state,
        TAXONOMY,
      ),
      null,
    )
  })

  it('rejects questions that no longer belong to the saved skill leaf', () => {
    const savedQuestions = [question('q1'), question('q2'), question('q3')]
    const state = initialState()
    const draft = createAdaptiveDraft(
      skillAssessment(savedQuestions),
      { q1: 'A' },
      state.onboarding.confirmedAt,
    )
    const changedBank = [
      savedQuestions[0],
      question('q2', { skill: 'Command of Evidence' }),
      savedQuestions[2],
    ]

    assert.equal(
      restoreAdaptiveDraft(draft, changedBank, state, TAXONOMY),
      null,
    )
  })

  it('restores only a checkpoint that is currently unlocked', () => {
    const questions = [question('q1'), question('q2'), question('q3')]
    let state = initialState()
    const assessment: AdaptiveAssessment = {
      kind: 'checkpoint',
      id: `checkpoint:${INFO}:Adventurer:0`,
      domain: INFO,
      level: 'Adventurer',
      questions,
      reusedCount: 0,
    }
    const lockedDraft = createAdaptiveDraft(
      assessment,
      {},
      state.onboarding.confirmedAt,
    )

    assert.equal(
      restoreAdaptiveDraft(lockedDraft, questions, state, TAXONOMY),
      null,
    )

    state = submitSkillQuiz(state, {
      domain: INFO,
      skill: SKILL,
      level: 'Adventurer',
      score: 3,
      questionIds: ['training-1', 'training-2', 'training-3'],
      purpose: 'training',
      timestamp: 200,
    })
    const restored = restoreAdaptiveDraft(
      lockedDraft,
      questions,
      state,
      TAXONOMY,
    )

    assert.ok(restored)
    assert.equal(restored.assessment.kind, 'checkpoint')
  })
})
