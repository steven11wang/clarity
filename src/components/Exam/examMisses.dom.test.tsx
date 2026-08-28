import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
})

const globals = globalThis as unknown as Record<string, unknown>
globals.window = dom.window
globals.document = dom.window.document
globals.localStorage = dom.window.localStorage
globals.CustomEvent = dom.window.CustomEvent

const { fileExamMisses } = await import('./PracticeExamPanel.tsx')
const { getAttempts, getReviews } = await import('../../storage/index.ts')
const { examReviewId } = await import('./reviewQuestion.ts')
type PracticeExam = Awaited<typeof import('./examData.ts')>['EXAM_CATALOG'] extends unknown
  ? import('./examData.ts').PracticeExam
  : never
type ExamResult = import('./ExamRunner.tsx').ExamResult

function question(id: string, answer: string | null) {
  return {
    id,
    number: Number(id.replace(/\D/g, '')),
    passage: [`Passage for ${id}.`],
    figure: null,
    stem: `Stem ${id}?`,
    choices: [
      { letter: 'A', text: 'alpha' },
      { letter: 'B', text: 'bravo' },
      { letter: 'C', text: 'charlie' },
      { letter: 'D', text: 'delta' },
    ],
    answer,
    topic: 'Craft and Structure',
    subtopic: 'Words in Context',
    difficulty: 'medium' as const,
    explanation: null,
  }
}

const exam = {
  id: 'cooksat-test-1',
  title: 'Practice Test 1',
  section: 'Reading and Writing',
  subject: 'Reading and Writing',
  answerKeySource: 'official',
  assetBase: '',
  modules: [
    {
      id: 'm1',
      number: 1,
      subject: 'Reading and Writing',
      label: 'Module 1',
      durationSeconds: 1920,
      questions: [question('q1', 'A'), question('q2', 'B'), question('q3', null)],
    },
    {
      id: 'm2',
      number: 2,
      subject: 'Reading and Writing',
      label: 'Module 2',
      durationSeconds: 1920,
      questions: [question('q4', 'C')],
    },
  ],
} as unknown as PracticeExam

function result(answers: Record<string, string>, untimed: boolean): ExamResult {
  return {
    answers,
    flagged: [],
    finishedAt: 1_700_000_000_000,
    timeLeft: {},
    overtime: {},
    questionSeconds: {},
    untimed,
    timingLabel: untimed ? 'Untimed' : 'Official pace',
  }
}

describe('filing practice exam misses', () => {
  beforeEach(() => {
    dom.window.localStorage.clear()
  })

  it('files every wrong answer into the resurrection queue', () => {
    fileExamMisses(exam, result({ q1: 'A', q2: 'D', q4: 'A' }, true))

    const reviews = getReviews()
    assert.deepEqual(
      Object.keys(reviews).sort(),
      [examReviewId('cooksat-test-1', 'q2'), examReviewId('cooksat-test-1', 'q4')].sort(),
    )
  })

  it('carries a copy of the question, since exam questions are not in the bank', () => {
    fileExamMisses(exam, result({ q2: 'D' }, true))

    const item = getReviews()[examReviewId('cooksat-test-1', 'q2')]
    assert.equal(item.source, 'exam')
    assert.equal(item.question?.prompt, 'Stem q2?')
    assert.equal(item.question?.answer, 'B')
    assert.equal(item.stage, 0)
  })

  it('skips questions the bank shipped without an answer key', () => {
    fileExamMisses(exam, result({}, true))
    assert.equal(getReviews()[examReviewId('cooksat-test-1', 'q3')], undefined)
  })

  it('reads a blank on the clock as a timeout and a blank without one as a miss', () => {
    fileExamMisses(exam, result({}, false))
    assert.equal(getReviews()[examReviewId('cooksat-test-1', 'q1')].reason, 'timeout')

    dom.window.localStorage.clear()
    fileExamMisses(exam, result({}, true))
    assert.equal(getReviews()[examReviewId('cooksat-test-1', 'q1')].reason, 'miss')
  })

  it('logs one attempt per miss, so the insights count them', () => {
    fileExamMisses(exam, result({ q1: 'A', q2: 'D', q4: 'A' }, true))

    const attempts = getAttempts()
    assert.equal(attempts.length, 2)
    assert.deepEqual(attempts.map((attempt) => attempt.correct), [false, false])
    assert.equal(new Set(attempts.map((attempt) => attempt.timestamp)).size, 2)
  })
})
