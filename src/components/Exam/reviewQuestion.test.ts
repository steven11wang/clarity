import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { ExamQuestion, PracticeExam } from './examData.ts'
import { examQuestionToReviewQuestion, examReviewId } from './reviewQuestion.ts'

const exam: PracticeExam = {
  id: 'cooksat-test-1',
  title: 'Practice Test 1',
  section: 'Reading and Writing',
  subject: 'Reading and Writing',
  answerKeySource: 'official',
  assetBase: 'cooksat-test-1-assets',
  modules: [],
}

function examQuestion(overrides: Partial<ExamQuestion> = {}): ExamQuestion {
  return {
    id: 'module-1-q4',
    number: 4,
    passage: ['First paragraph.', 'Second paragraph.'],
    figure: null,
    stem: 'Which choice completes the text?',
    choices: [
      { letter: 'A', text: 'alpha' },
      { letter: 'B', text: 'bravo' },
      { letter: 'C', text: 'charlie' },
      { letter: 'D', text: 'delta' },
    ],
    answer: 'C',
    topic: 'Craft and Structure',
    subtopic: 'Words in Context',
    difficulty: 'hard',
    explanation: {
      summary: 'C matches the contrast the sentence sets up.',
      choices: { A: 'A is too extreme.', C: 'C is the key.' },
    },
    ...overrides,
  }
}

describe('exam question to review question', () => {
  it('namespaces the id by exam, since exam ids repeat across exams', () => {
    const question = examQuestionToReviewQuestion(exam, examQuestion())
    assert.equal(question?.id, examReviewId('cooksat-test-1', 'module-1-q4'))
  })

  it('carries the passage, choices, key and skill tags across', () => {
    const question = examQuestionToReviewQuestion(exam, examQuestion())
    assert.ok(question)
    assert.equal(question.passage, 'First paragraph.\n\nSecond paragraph.')
    assert.deepEqual(question.choices, { A: 'alpha', B: 'bravo', C: 'charlie', D: 'delta' })
    assert.equal(question.answer, 'C')
    assert.equal(question.domain, 'Craft and Structure')
    assert.equal(question.skill, 'Words in Context')
    assert.equal(question.difficulty, 'hard')
  })

  it('builds a rationale from the summary and the per-choice notes', () => {
    const question = examQuestionToReviewQuestion(exam, examQuestion())
    assert.match(question!.rationale, /C matches the contrast/)
    assert.match(question!.rationale, /A: A is too extreme\./)
  })

  it('still produces a rationale when the bank shipped no explanation', () => {
    const question = examQuestionToReviewQuestion(exam, examQuestion({ explanation: null }))
    assert.equal(question?.rationale, 'The correct answer is C.')
  })

  it('falls back to Untagged rather than dropping an untagged question', () => {
    const question = examQuestionToReviewQuestion(
      exam,
      examQuestion({ topic: null, subtopic: null, difficulty: null }),
    )
    assert.equal(question?.domain, 'Untagged')
    assert.equal(question?.skill, 'Untagged')
  })

  it('refuses a question with no answer key', () => {
    assert.equal(examQuestionToReviewQuestion(exam, examQuestion({ answer: null })), null)
  })

  it('refuses a question that is missing one of the four choices', () => {
    const short = examQuestion({
      choices: [
        { letter: 'A', text: 'alpha' },
        { letter: 'B', text: 'bravo' },
        { letter: 'C', text: 'charlie' },
      ],
    })
    assert.equal(examQuestionToReviewQuestion(exam, short), null)
  })

  it('keeps a table over a figure, the order the passage renderer reads them in', () => {
    const withBoth = examQuestion({
      figure: { alt: 'A chart.', src: 'chart.png' },
      table: { caption: null, headers: ['Year'], rows: [['1999']] },
    })
    const question = examQuestionToReviewQuestion(exam, withBoth)
    assert.equal(question?.figure_type, 'table')
    assert.deepEqual(question?.table, { headers: ['Year'], rows: [['1999']] })
    assert.equal(question?.image, undefined)
  })

  it('points a figure at its asset path without the deploy base', () => {
    const question = examQuestionToReviewQuestion(
      exam,
      examQuestion({ figure: { alt: 'A chart.', src: 'chart.png' } }),
    )
    assert.equal(question?.image, '/data/practice-exams/chart.png')
    assert.equal(question?.figure_description, 'A chart.')
  })
})
