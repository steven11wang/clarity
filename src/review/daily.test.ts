import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { WordBankEntry } from '../dictionary/wordBank.ts'
import type { Question, ReviewItem } from '../types.ts'
import {
  DAY_START_HOUR,
  EMPTY_DAILY_STATE,
  buildDailyPlan,
  completeDay,
  dayKey,
  liveStreak,
  markPrompted,
  previousDayKey,
  shouldPrompt,
} from './daily.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function question(id: string): Question {
  return {
    id,
    assessment: 'SAT',
    test: 'Reading and Writing',
    domain: 'Information and Ideas',
    skill: 'Central Ideas',
    difficulty: 'Medium',
    passage: 'passage',
    prompt: `prompt ${id}`,
    choices: { A: 'a', B: 'b', C: 'c', D: 'd' },
    answer: 'A',
    rationale: 'because',
  }
}

function review(questionId: string, stage: number, dueAt: number): ReviewItem {
  return {
    questionId,
    createdAt: 0,
    dueAt,
    stage,
    reason: 'miss',
    clears: stage,
    lastReviewedAt: null,
  }
}

function word(id: string, stage: number, dueAt: number): WordBankEntry {
  return {
    id,
    word: id,
    partOfSpeech: 'noun',
    definition: 'a definition',
    sentence: `A sentence with ${id} in it.`,
    source: null,
    savedAt: 0,
    stage,
    dueAt,
    clears: stage,
    lapses: 0,
    lastReviewedAt: null,
  }
}

// A fixed local noon, so the 4am rollover can be probed from both sides without
// the test depending on the machine's timezone.
const noon = new Date(2026, 7, 12, 12, 0, 0).getTime()

describe('day boundary', () => {
  it('rolls the day over at 4am local, not midnight', () => {
    const justBefore = new Date(2026, 7, 12, DAY_START_HOUR - 1, 30).getTime()
    const justAfter = new Date(2026, 7, 12, DAY_START_HOUR, 30).getTime()
    assert.equal(dayKey(justBefore), '2026-08-11')
    assert.equal(dayKey(justAfter), '2026-08-12')
  })

  it('steps back a day across a month boundary', () => {
    assert.equal(previousDayKey('2026-08-01'), '2026-07-31')
    assert.equal(previousDayKey('2026-01-01'), '2025-12-31')
  })
})

describe('daily plan', () => {
  const questions = [question('q1'), question('q2'), question('q3')]

  it('collects due questions and words, oldest debt first', () => {
    const reviews = {
      q1: review('q1', 0, noon - 2 * HOUR),
      q2: review('q2', 2, noon - 5 * HOUR),
      q3: review('q3', 0, noon + DAY), // not due yet
    }
    const words = [word('lucid', 0, noon - HOUR), word('sanguine', 1, noon + DAY)]

    const plan = buildDailyPlan(questions, reviews, words, noon, false)

    assert.deepEqual(plan.questions.map((entry) => entry.id), ['q2', 'q1'])
    assert.deepEqual(plan.words.map((entry) => entry.id), ['lucid'])
    assert.equal(plan.total, 3)
  })

  it('groups the plan by how long each item was away', () => {
    const reviews = {
      q1: review('q1', 0, noon - HOUR),
      q2: review('q2', 0, noon - HOUR),
      q3: review('q3', 2, noon - HOUR),
    }
    const words = [word('lucid', 0, noon - HOUR)]

    const plan = buildDailyPlan(questions, reviews, words, noon, false)

    assert.deepEqual(plan.cohorts, [
      { stage: 0, label: 'Yesterday', questions: 2, words: 1 },
      { stage: 2, label: 'A week back', questions: 1, words: 0 },
    ])
  })

  it('drops reviews whose question is no longer in the bank', () => {
    const reviews = { ghost: review('ghost', 0, noon - HOUR) }
    const plan = buildDailyPlan(questions, reviews, [], noon, false)
    assert.equal(plan.total, 0)
  })

  it('skips retired items on both ladders', () => {
    const reviews = { q1: review('q1', -1, noon - DAY) }
    const words = [word('lucid', -1, noon - DAY)]
    const plan = buildDailyPlan(questions, reviews, words, noon, false)
    assert.equal(plan.total, 0)
  })
})

describe('daily briefing bookkeeping', () => {
  const questions = [question('q1')]
  const plan = buildDailyPlan(
    questions,
    { q1: review('q1', 0, noon - HOUR) },
    [],
    noon,
    false,
  )

  it('prompts once per day and only when something is due', () => {
    assert.equal(shouldPrompt(EMPTY_DAILY_STATE, plan), true)
    const prompted = markPrompted(EMPTY_DAILY_STATE, plan.day)
    assert.equal(shouldPrompt(prompted, plan), false)

    const empty = buildDailyPlan(questions, {}, [], noon, false)
    assert.equal(shouldPrompt(EMPTY_DAILY_STATE, empty), false)
  })

  it('prompts again on the next day', () => {
    const prompted = markPrompted(EMPTY_DAILY_STATE, previousDayKey(plan.day))
    assert.equal(shouldPrompt(prompted, plan), true)
  })

  it('extends the streak on consecutive days and restarts after a gap', () => {
    const first = completeDay(EMPTY_DAILY_STATE, '2026-08-10')
    assert.equal(first.streak, 1)

    const second = completeDay(first, '2026-08-11')
    assert.equal(second.streak, 2)

    const afterGap = completeDay(second, '2026-08-14')
    assert.equal(afterGap.streak, 1)
  })

  it('is idempotent within a day', () => {
    const once = completeDay(EMPTY_DAILY_STATE, '2026-08-10')
    const twice = completeDay(once, '2026-08-10')
    assert.equal(twice.streak, 1)
    assert.equal(twice, once)
  })

  it('carries the streak through an unfinished today and drops it after a missed day', () => {
    const done = completeDay(EMPTY_DAILY_STATE, '2026-08-11')
    assert.equal(liveStreak(done, '2026-08-11'), 1)
    assert.equal(liveStreak(done, '2026-08-12'), 1)
    assert.equal(liveStreak(done, '2026-08-13'), 0)
  })
})
