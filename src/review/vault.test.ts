import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Question, ReviewItem } from '../types.ts'
import { RETIRED_STAGE } from './schedule.ts'
import { buildVault, formatDueIn, vaultCounts } from './vault.ts'

function question(id: string): Question {
  return {
    id,
    assessment: 'SAT',
    test: 'Reading and Writing',
    domain: 'Information and Ideas',
    skill: 'Central Ideas and Details',
    difficulty: 'Medium',
    passage: 'Passage.',
    prompt: 'Prompt?',
    choices: { A: 'a', B: 'b', C: 'c', D: 'd' },
    answer: 'A',
    rationale: 'Because.',
  }
}

function review(id: string, dueAt: number, stage = 0): ReviewItem {
  return {
    questionId: id,
    createdAt: 0,
    dueAt,
    stage,
    reason: 'miss',
    clears: 0,
    lastReviewedAt: null,
  }
}

const NOW = 1_000_000

describe('mistake vault', () => {
  it('orders due items first, then upcoming returns, then retired', () => {
    const entries = buildVault(
      ['q1', 'q2', 'q3', 'q4'].map(question),
      {
        q1: review('q1', NOW + 5000),
        q2: review('q2', NOW - 5000),
        q3: review('q3', NOW, RETIRED_STAGE),
        q4: review('q4', NOW - 50_000),
      },
      NOW,
    )

    assert.deepEqual(entries.map((entry) => entry.question.id), ['q4', 'q2', 'q1', 'q3'])
    assert.deepEqual(entries.map((entry) => entry.status), ['due', 'due', 'scheduled', 'retired'])
    assert.deepEqual(vaultCounts(entries), { due: 2, scheduled: 1, retired: 1 })
  })

  it('drops review entries whose question left the bank', () => {
    const entries = buildVault([question('q1')], { q1: review('q1', NOW), gone: review('gone', NOW) }, NOW)
    assert.deepEqual(entries.map((entry) => entry.question.id), ['q1'])
  })

  it('describes the next return in coarse units', () => {
    assert.equal(formatDueIn(0), 'Ready now')
    assert.equal(formatDueIn(-5000), 'Ready now')
    assert.equal(formatDueIn(30 * 60 * 1000), 'in 30 min')
    assert.equal(formatDueIn(2 * 60 * 60 * 1000), 'in 2 hours')
    assert.equal(formatDueIn(24 * 60 * 60 * 1000), 'in 1 day')
    assert.equal(formatDueIn(3 * 24 * 60 * 60 * 1000), 'in 3 days')
  })
})
