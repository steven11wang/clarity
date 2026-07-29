import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Question } from '../types.ts'
import { SAT_DOMAINS } from './config.ts'
import {
  buildTaxonomy,
  selectCheckpointQuestions,
  selectSkillQuestions,
} from './questions.ts'

const DOMAIN = 'Information and Ideas' as const
const SKILL = 'Inferences'

function question(
  id: string,
  skill = SKILL,
  domain: Question['domain'] = DOMAIN,
  difficulty: Question['difficulty'] = 'Easy',
): Question {
  return {
    id,
    assessment: 'SAT',
    test: 'Reading and Writing',
    domain,
    skill,
    difficulty,
    passage: `Passage for ${id}`,
    prompt: `Prompt for ${id}`,
    choices: { A: 'A', B: 'B', C: 'C', D: 'D' },
    answer: 'A',
    rationale: `Rationale for ${id}`,
  }
}

function ids(questions: readonly Question[]): string[] {
  return questions.map((item) => item.id)
}

describe('buildTaxonomy', () => {
  it('returns all configured domains with unique, stable skill ordering', () => {
    const taxonomy = buildTaxonomy([
      question('i-1', 'Words in Context', 'Craft and Structure'),
      question('i-2', 'Inferences'),
      question('i-3', 'Central Ideas and Details'),
      question('i-4', 'Inferences'),
      question('i-5', 'Boundaries', 'Standard English Conventions'),
    ])

    assert.deepEqual(Object.keys(taxonomy), [...SAT_DOMAINS])
    assert.deepEqual(taxonomy['Information and Ideas'], [
      'Central Ideas and Details',
      'Inferences',
    ])
    assert.deepEqual(taxonomy['Craft and Structure'], ['Words in Context'])
    assert.deepEqual(taxonomy['Expression of Ideas'], [])
    assert.deepEqual(taxonomy['Standard English Conventions'], ['Boundaries'])
  })
})

describe('selectSkillQuestions', () => {
  it('selects exactly three unique questions deterministically', () => {
    const questions = [
      question('q-1'),
      question('q-2'),
      question('q-3'),
      question('q-4'),
      question('q-5'),
      question('q-1'),
    ]
    const input = {
      questions,
      domain: DOMAIN,
      skill: SKILL,
      level: 'Noobie' as const,
      questionIdHistory: [],
      immediateAvoidIds: [],
      seed: 'student-7',
      attemptOrdinal: 2,
    }

    const first = selectSkillQuestions(input)
    const second = selectSkillQuestions(input)

    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    if (!first.ok || !second.ok) return
    assert.equal(first.questions.length, 3)
    assert.equal(new Set(ids(first.questions)).size, 3)
    assert.deepEqual(ids(first.questions), ids(second.questions))
  })

  it('prefers questions never seen and outside the immediate-avoid set', () => {
    const result = selectSkillQuestions({
      questions: Array.from({ length: 6 }, (_, index) => question(`q-${index + 1}`)),
      domain: DOMAIN,
      skill: SKILL,
      level: 'Noobie',
      questionIdHistory: ['q-1', 'q-2', 'q-3'],
      immediateAvoidIds: ['q-1', 'q-2', 'q-3'],
      seed: 'fresh',
      attemptOrdinal: 1,
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(ids(result.questions).sort(), ['q-4', 'q-5', 'q-6'])
    assert.deepEqual(result.reusedQuestionIds, [])
    assert.deepEqual(result.immediatelyReusedQuestionIds, [])
  })

  it('uses duplicate history entries as use counts, then least-recent use', () => {
    const result = selectSkillQuestions({
      questions: Array.from({ length: 5 }, (_, index) => question(`q-${index + 1}`)),
      domain: DOMAIN,
      skill: SKILL,
      level: 'Noobie',
      questionIdHistory: [
        'q-1',
        'q-4',
        'q-1',
        'q-5',
        'q-4',
        'q-5',
        'q-2',
        'q-3',
        'q-5',
      ],
      immediateAvoidIds: [],
      seed: 'usage',
      attemptOrdinal: 3,
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(ids(result.questions), ['q-2', 'q-3', 'q-1'])
    assert.deepEqual(result.reusedQuestionIds, ['q-2', 'q-3', 'q-1'])
  })

  it('falls back to the least-recent immediate reuse when the pool is exhausted', () => {
    const result = selectSkillQuestions({
      questions: Array.from({ length: 4 }, (_, index) => question(`q-${index + 1}`)),
      domain: DOMAIN,
      skill: SKILL,
      level: 'Noobie',
      questionIdHistory: ['q-1', 'q-2', 'q-3', 'q-4'],
      immediateAvoidIds: ['q-2', 'q-3', 'q-4'],
      seed: 'fallback',
      attemptOrdinal: 4,
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(ids(result.questions), ['q-1', 'q-2', 'q-3'])
    assert.deepEqual(result.reusedQuestionIds, ['q-1', 'q-2', 'q-3'])
    assert.deepEqual(result.immediatelyReusedQuestionIds, ['q-2', 'q-3'])
  })

  it('returns a discriminated insufficient error for a leaf under three', () => {
    const result = selectSkillQuestions({
      questions: [question('q-1'), question('q-2'), question('q-1')],
      domain: DOMAIN,
      skill: SKILL,
      level: 'Noobie',
      questionIdHistory: [],
      immediateAvoidIds: [],
      seed: 'short',
      attemptOrdinal: 0,
    })

    assert.deepEqual(result, {
      ok: false,
      reason: 'insufficient-questions',
      domain: DOMAIN,
      skill: SKILL,
      level: 'Noobie',
      difficulty: 'Easy',
      required: 3,
      available: 2,
    })
  })
})

describe('selectCheckpointQuestions', () => {
  it('selects exactly three per skill and deterministically interleaves them', () => {
    const questions = [
      ...Array.from({ length: 5 }, (_, index) => question(`inference-${index + 1}`)),
      ...Array.from({ length: 5 }, (_, index) =>
        question(`evidence-${index + 1}`, 'Command of Evidence'),
      ),
    ]
    const input = {
      questions,
      domain: DOMAIN,
      level: 'Noobie' as const,
      questionIdHistory: ['inference-1', 'evidence-1'],
      immediateAvoidIds: ['inference-1', 'evidence-1'],
      seed: 'checkpoint',
      attemptOrdinal: 1,
    }

    const first = selectCheckpointQuestions(input)
    const second = selectCheckpointQuestions(input)

    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    if (!first.ok || !second.ok) return

    assert.equal(first.questions.length, 6)
    assert.equal(new Set(ids(first.questions)).size, 6)
    assert.deepEqual(ids(first.questions), ids(second.questions))
    assert.deepEqual(first.skills, ['Command of Evidence', 'Inferences'])

    const counts = new Map<string, number>()
    for (const item of first.questions) {
      counts.set(item.skill, (counts.get(item.skill) ?? 0) + 1)
    }
    assert.deepEqual(Object.fromEntries(counts), {
      'Command of Evidence': 3,
      Inferences: 3,
    })
    for (let index = 1; index < first.questions.length; index += 1) {
      assert.notEqual(first.questions[index - 1].skill, first.questions[index].skill)
    }
  })

  it('fails the checkpoint atomically when one skill leaf is insufficient', () => {
    const result = selectCheckpointQuestions({
      questions: [
        question('inference-1'),
        question('inference-2'),
        question('inference-3'),
        question('evidence-1', 'Command of Evidence'),
        question('evidence-2', 'Command of Evidence'),
      ],
      domain: DOMAIN,
      level: 'Noobie',
      questionIdHistory: [],
      immediateAvoidIds: [],
      seed: 'short-checkpoint',
      attemptOrdinal: 0,
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.reason, 'insufficient-questions')
    assert.equal(result.skill, 'Command of Evidence')
    assert.equal(result.available, 2)
  })
})
