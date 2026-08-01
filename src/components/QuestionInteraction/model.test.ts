import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { FirstPass, Question } from '../../types.ts'
import {
  firstPassAttempt,
  initReview,
  setCause,
  setContrast,
  submitRedo,
  toggleChoiceStrikeout,
  toAttempt,
  answerChoiceStatus,
} from './model.ts'

const question = { id: 'q1', answer: 'B', skill: 'Inferences' } as unknown as Question

const missed: FirstPass = { chosen: 'A', confidence: 'sure', correct: false, timeMs: null, timedOut: false, struckChoices: [] }

describe('review loop model', () => {
  it('adds and removes one struck choice without mutating the source list', () => {
    const source = ['B']
    const struck = toggleChoiceStrikeout(source, 'C')

    assert.deepEqual(struck, ['B', 'C'])
    assert.deepEqual(source, ['B'])
    assert.deepEqual(toggleChoiceStrikeout(struck, 'B'), ['C'])
  })

  it('does not duplicate a choice when toggled repeatedly', () => {
    assert.deepEqual(toggleChoiceStrikeout(toggleChoiceStrikeout([], 'A'), 'A'), [])
  })

  it('tracks strike-out separately from the selected answer', () => {
    const selected = 'B'
    const struck = toggleChoiceStrikeout([], 'A')

    assert.equal(selected, 'B')
    assert.deepEqual(struck, ['A'])
  })

  it('identifies the correct choice and the original wrong choice', () => {
    assert.deepEqual(answerChoiceStatus('A', 'A', 'C'), { isCorrect: true, isChosenWrong: false })
    assert.deepEqual(answerChoiceStatus('C', 'A', 'C'), { isCorrect: false, isChosenWrong: true })
  })

  it('does not mark a choice as chosen when the student timed out', () => {
    assert.deepEqual(answerChoiceStatus('C', 'A', ''), { isCorrect: false, isChosenWrong: false })
  })

  it('starts at redo seeded with the answer-pass result', () => {
    const state = initReview(question, missed, 0)
    assert.equal(state.phase, 'redo')
    assert.equal(state.correct, false)
    assert.equal(state.confidence, 'sure')
    assert.equal(state.firstChoice, 'A')
  })

  it('redoes answer-until-correct, then routes a missed answer to the contrast', () => {
    let state = initReview(question, missed, 0)
    state = submitRedo(state, 'C') // wrong
    assert.equal(state.phase, 'redo')
    assert.deepEqual(state.wrongChoices, ['C'])
    state = submitRedo(state, 'B') // correct
    assert.equal(state.phase, 'contrast')
    assert.equal(state.attempts, 2)
  })

  it('runs the full missed-answer path and merges answer-pass data into the attempt', () => {
    let state = initReview(question, missed, 1)
    state = submitRedo(state, 'B')
    assert.equal(state.phase, 'contrast')
    state = setContrast(state, 'It was too extreme or absolute')
    assert.equal(state.phase, 'cause')
    state = setCause(state, 'trap')
    assert.equal(state.phase, 'done')

    const attempt = toAttempt(state, 'q1', 200)
    assert.equal(attempt.chosen, 'A') // the committed answer, not the redo
    assert.equal(attempt.correct, false)
    assert.equal(attempt.confidence, 'sure')
    assert.equal(attempt.errorCause, 'trap')
    assert.deepEqual(attempt.selfExplanations, {
      whyWrong: 'It was too extreme or absolute',
      whyRight: '',
      selfGrade: null,
    })
    assert.equal(attempt.resurrectionStage, 1)
    assert.equal(attempt.hiddenError, false)
  })

  it('logs a correct answer as a minimal attempt (no diagnosis)', () => {
    const fp: FirstPass = { chosen: 'B', confidence: 'leaning', correct: true, timeMs: 5000, timedOut: false, struckChoices: [] }
    const attempt = firstPassAttempt('q1', fp, 0, 100)
    assert.equal(attempt.correct, true)
    assert.equal(attempt.confidence, 'leaning')
    assert.equal(attempt.errorCause, null)
    assert.equal(attempt.timeSpentMs, 5000)
    assert.equal(attempt.hiddenError, false)
  })

  it('in a review-all pass, an already-correct answer finishes after the redo', () => {
    const rightPass: FirstPass = { chosen: 'B', confidence: 'guessing', correct: true, timeMs: null, timedOut: false, struckChoices: [] }
    let state = initReview(question, rightPass, 0)
    state = submitRedo(state, 'B') // nothing to diagnose
    assert.equal(state.phase, 'done')
    assert.equal(toAttempt(state, 'q1', 300).selfExplanations, null)
  })
})
