import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Question } from '../types.ts'
import {
  checkpointRetakeImmediateAvoidIds,
  repairImmediateAvoidIds,
} from './freshness.ts'
import {
  selectCheckpointQuestions,
  selectSkillQuestions,
} from './questions.ts'

function question(
  id: string,
  skill: string,
  domain = 'Expression of Ideas',
  difficulty = 'Medium',
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

describe('repairImmediateAvoidIds', () => {
  it('combines the latest quiz with only this skill from the triggering checkpoint', () => {
    const result = repairImmediateAvoidIds({
      questions: [
        question('transition-1', 'Transitions'),
        question('transition-2', 'Transitions'),
        question('synthesis-1', 'Rhetorical Synthesis'),
      ],
      skill: 'Transitions',
      latestQuizQuestionIds: ['transition-0', 'transition-1'],
      triggeringCheckpointQuestionIds: [
        'synthesis-1',
        'transition-1',
        'transition-2',
        'missing-from-bank',
      ],
    })

    assert.deepEqual(result, ['transition-0', 'transition-1', 'transition-2'])
  })

  it('minimizes direct checkpoint repeats in a five-question repair pool', () => {
    const questions = Array.from({ length: 5 }, (_, index) =>
      question(
        `cross-text-${index + 1}`,
        'Cross-Text Connections',
        'Craft and Structure',
      ),
    )
    const latestQuiz = ['cross-text-1', 'cross-text-2', 'cross-text-3']
    const triggeringCheckpoint = ['cross-text-4', 'cross-text-5', 'cross-text-1']
    const immediateAvoidIds = repairImmediateAvoidIds({
      questions,
      skill: 'Cross-Text Connections',
      latestQuizQuestionIds: latestQuiz,
      triggeringCheckpointQuestionIds: triggeringCheckpoint,
    })

    const selection = selectSkillQuestions({
      questions,
      domain: 'Craft and Structure',
      skill: 'Cross-Text Connections',
      level: 'Adventurer',
      questionIdHistory: [...latestQuiz, ...triggeringCheckpoint],
      immediateAvoidIds,
      seed: 'repair',
      attemptOrdinal: 1,
    })

    assert.equal(selection.ok, true)
    if (!selection.ok) return
    const checkpointIds = new Set(triggeringCheckpoint)
    const repeatedFromCheckpoint = selection.questions.filter((item) =>
      checkpointIds.has(item.id),
    )
    // Five total questions cannot produce a disjoint three-question repair,
    // but only one repeat is mathematically necessary.
    assert.equal(repeatedFromCheckpoint.length, 1)
  })
})

describe('checkpointRetakeImmediateAvoidIds', () => {
  it('includes the previous checkpoint and deduplicated repair attempts after it', () => {
    const result = checkpointRetakeImmediateAvoidIds(
      {
        timestamp: 100,
        questionIds: ['checkpoint-1', 'checkpoint-2', 'checkpoint-1'],
      },
      [
        {
          timestamp: 90,
          purpose: 'checkpoint-repair',
          questionIds: ['old-repair'],
        },
        {
          timestamp: 110,
          purpose: 'training',
          questionIds: ['later-training'],
        },
        {
          timestamp: 120,
          purpose: 'checkpoint-repair',
          questionIds: ['repair-2', 'repair-3'],
        },
        {
          timestamp: 105,
          purpose: 'checkpoint-repair',
          questionIds: ['repair-1', 'repair-2'],
        },
      ],
    )

    assert.deepEqual(result, [
      'checkpoint-1',
      'checkpoint-2',
      'repair-1',
      'repair-2',
      'repair-3',
    ])
    assert.deepEqual(
      checkpointRetakeImmediateAvoidIds(undefined, [
        {
          timestamp: 1,
          purpose: 'checkpoint-repair',
          questionIds: ['repair-without-checkpoint'],
        },
      ]),
      [],
    )
  })

  it('keeps a retake off recent repairs when older alternatives exist', () => {
    const skills = ['Rhetorical Synthesis', 'Transitions']
    const questions = skills.flatMap((skill) =>
      Array.from({ length: 10 }, (_, index) =>
        question(`${skill}-${index + 1}`, skill),
      ),
    )
    const previousCheckpointIds = skills.flatMap((skill) => [
      `${skill}-1`,
      `${skill}-2`,
      `${skill}-3`,
    ])
    const repairIds = skills.flatMap((skill) => [
      `${skill}-4`,
      `${skill}-5`,
      `${skill}-6`,
    ])
    const history = skills.flatMap((skill) => [
      `${skill}-1`,
      `${skill}-2`,
      `${skill}-3`,
      `${skill}-4`,
      `${skill}-5`,
      `${skill}-6`,
      `${skill}-7`,
      `${skill}-8`,
      `${skill}-9`,
      `${skill}-10`,
      `${skill}-7`,
      `${skill}-8`,
      `${skill}-9`,
      `${skill}-10`,
    ])
    const immediateAvoidIds = checkpointRetakeImmediateAvoidIds(
      { timestamp: 100, questionIds: previousCheckpointIds },
      [
        {
          timestamp: 110,
          purpose: 'checkpoint-repair',
          questionIds: repairIds,
        },
      ],
    )

    const selection = selectCheckpointQuestions({
      questions,
      domain: 'Expression of Ideas',
      level: 'Adventurer',
      questionIdHistory: history,
      immediateAvoidIds,
      seed: 'retake',
      attemptOrdinal: 1,
    })

    assert.equal(selection.ok, true)
    if (!selection.ok) return
    const recentIds = new Set([...previousCheckpointIds, ...repairIds])
    assert.equal(
      selection.questions.some((item) => recentIds.has(item.id)),
      false,
    )
  })
})
