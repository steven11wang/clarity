import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { FirstPass, Question } from '../../types.ts'
import {
  firstPassAttempt,
  initReview,
  isHiddenError,
  setCause,
  setChain,
  setChainBreak,
  setEvidence,
  setEvidenceGrade,
  setExplain,
  setSelfGrade,
  setTrap,
  submitRedo,
  toAttempt,
  answerChoiceStatus,
} from './model.ts'

const question = { id: 'q1', answer: 'B', skill: 'Inferences' } as unknown as Question

const missed: FirstPass = { chosen: 'A', confidence: 'sure', correct: false, timeMs: null, timedOut: false }

describe('review loop model', () => {
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

  it('redoes answer-until-correct, then routes a missed answer to the autopsy', () => {
    let state = initReview(question, missed, 0)
    state = submitRedo(state, 'C') // wrong
    assert.equal(state.phase, 'redo')
    assert.deepEqual(state.wrongChoices, ['C'])
    state = submitRedo(state, 'B') // correct
    assert.equal(state.phase, 'cause')
    assert.equal(state.attempts, 2)
  })

  it('runs the full missed-answer path and merges answer-pass data into the attempt', () => {
    let state = initReview(question, missed, 1)
    state = submitRedo(state, 'B')
    state = setCause(state, 'trap')
    state = setExplain(state, 'It was too extreme or absolute')
    assert.equal(state.whyRight, '') // "why is the correct one right" removed
    state = setSelfGrade(state, 'partly')
    state = setEvidence(state, [1])
    state = setEvidenceGrade(state, 'partial')
    state = setChain(state, 1, false)
    assert.equal(state.phase, 'chain-break')
    state = setChainBreak(state, 'question')
    assert.equal(state.phase, 'trap')
    state = setTrap(state, 'too-extreme')
    assert.equal(state.phase, 'done')

    const attempt = toAttempt(state, 'q1', 200)
    assert.equal(attempt.chosen, 'A') // the committed answer, not the redo
    assert.equal(attempt.correct, false)
    assert.equal(attempt.confidence, 'sure')
    assert.equal(attempt.errorCause, 'trap')
    assert.equal(attempt.trapGuess, 'too-extreme')
    assert.equal(attempt.resurrectionStage, 1)
    assert.equal(attempt.hiddenError, false)
  })

  it('logs a correct answer as a minimal attempt (no diagnosis)', () => {
    const fp: FirstPass = { chosen: 'B', confidence: 'leaning', correct: true, timeMs: 5000, timedOut: false }
    const attempt = firstPassAttempt('q1', fp, 0, 100)
    assert.equal(attempt.correct, true)
    assert.equal(attempt.confidence, 'leaning')
    assert.equal(attempt.errorCause, null)
    assert.equal(attempt.timeSpentMs, 5000)
    assert.equal(attempt.hiddenError, false)
  })

  it('in a review-all pass, a correct redo with missed evidence is a hidden error', () => {
    const rightPass: FirstPass = { chosen: 'B', confidence: 'guessing', correct: true, timeMs: null, timedOut: false }
    let state = initReview(question, rightPass, 0)
    state = submitRedo(state, 'B') // correct → evidence, not cause
    assert.equal(state.phase, 'evidence')
    state = setEvidence(state, [])
    state = setEvidenceGrade(state, 'miss')
    assert.equal(isHiddenError(state), true)
  })
})
