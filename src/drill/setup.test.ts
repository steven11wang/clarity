import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Attempt, Question } from '../types.ts'
import {
  ALL_SKILLS,
  ANY_DIFFICULTY,
  DEFAULT_DRILL_SETUP,
  MIXED_DOMAIN,
  drillPool,
  drillSkills,
  drillTargetLabel,
  lastSeenAt,
  normalizeDrillSetup,
  selectDrillQuestions,
  withDomain,
} from './setup.ts'

function question(
  id: string,
  domain: string,
  skill: string,
  difficulty: string,
): Question {
  return {
    id,
    assessment: 'SAT',
    test: 'Reading and Writing',
    domain,
    skill,
    difficulty,
    passage: 'Passage.',
    prompt: 'Prompt?',
    choices: { A: 'a', B: 'b', C: 'c', D: 'd' },
    answer: 'A',
    rationale: 'Because.',
  }
}

function attempt(questionId: string, timestamp: number): Attempt {
  return {
    questionId,
    timestamp,
    chosen: 'A',
    correct: true,
    confidence: null,
    attemptsToCorrect: 1,
    errorCause: null,
    selfExplanations: null,
    evidenceUnderlined: [],
    evidenceScore: null,
    chainBreakLink: null,
    trapGuess: null,
    trapActual: null,
    hiddenError: false,
    resurrectionStage: 0,
    timeSpentMs: null,
    timedOut: false,
  }
}

const BANK: Question[] = [
  question('a1', 'Information and Ideas', 'Central Ideas and Details', 'Easy'),
  question('a2', 'Information and Ideas', 'Central Ideas and Details', 'Hard'),
  question('a3', 'Information and Ideas', 'Command of Evidence', 'Hard'),
  question('b1', 'Craft and Structure', 'Words in Context', 'Medium'),
  question('b2', 'Craft and Structure', 'Text Structure and Purpose', 'Hard'),
]

describe('drill setup', () => {
  it('filters the bank by domain, skill and difficulty together', () => {
    assert.deepEqual(
      drillPool(BANK, {
        ...DEFAULT_DRILL_SETUP,
        domain: 'Information and Ideas',
        skill: 'Central Ideas and Details',
        difficulty: 'Hard',
      }).map((entry) => entry.id),
      ['a2'],
    )
  })

  it('takes the whole bank when the target is mixed and open', () => {
    assert.equal(drillPool(BANK, DEFAULT_DRILL_SETUP).length, BANK.length)
  })

  it('lists only the skills a domain actually has questions for', () => {
    assert.deepEqual(drillSkills(BANK, 'Craft and Structure'), [
      'Words in Context',
      'Text Structure and Purpose',
    ])
    assert.deepEqual(drillSkills(BANK, MIXED_DOMAIN), [])
  })

  it('drops the skill when the domain changes', () => {
    const next = withDomain(
      { ...DEFAULT_DRILL_SETUP, domain: 'Information and Ideas', skill: 'Command of Evidence' },
      'Craft and Structure',
    )
    assert.equal(next.domain, 'Craft and Structure')
    assert.equal(next.skill, ALL_SKILLS)
  })

  it('hands back never-seen questions before ones answered long ago', () => {
    const seen = lastSeenAt([attempt('a1', 500), attempt('a2', 100), attempt('a2', 900)])
    const picked = selectDrillQuestions(
      BANK,
      { ...DEFAULT_DRILL_SETUP, domain: 'Information and Ideas', count: 3 },
      { seen },
    )
    assert.deepEqual(picked.map((entry) => entry.id), ['a3', 'a1', 'a2'])
  })

  it('never hands back more than the requested length', () => {
    assert.equal(selectDrillQuestions(BANK, { ...DEFAULT_DRILL_SETUP, count: 2 }).length, 2)
  })

  it('reshuffles ties when the seed changes', () => {
    const setup = { ...DEFAULT_DRILL_SETUP, count: 5 }
    const first = selectDrillQuestions(BANK, setup, { seed: 1 }).map((entry) => entry.id)
    const second = selectDrillQuestions(BANK, setup, { seed: 7 }).map((entry) => entry.id)
    assert.equal(first.length, second.length)
    assert.notDeepEqual(first, second)
  })

  it('restores a persisted setup and repairs what the bank cannot honour', () => {
    assert.deepEqual(normalizeDrillSetup(null), DEFAULT_DRILL_SETUP)
    assert.deepEqual(
      normalizeDrillSetup({
        domain: MIXED_DOMAIN,
        skill: 'Words in Context',
        difficulty: 'Impossible',
        count: 7,
        secondsPerQuestion: 33,
      }),
      DEFAULT_DRILL_SETUP,
    )
    assert.equal(normalizeDrillSetup({ secondsPerQuestion: null }).secondsPerQuestion, null)
  })

  it('names the target in the readout', () => {
    assert.equal(drillTargetLabel(DEFAULT_DRILL_SETUP), 'Every domain · any difficulty')
    assert.equal(
      drillTargetLabel({
        ...DEFAULT_DRILL_SETUP,
        domain: 'Craft and Structure',
        skill: 'Words in Context',
        difficulty: 'Hard',
      }),
      'Craft and Structure · Words in Context · Hard',
    )
  })
})
