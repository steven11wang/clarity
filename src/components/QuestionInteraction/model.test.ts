import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Question } from '../../types.ts'
import {
  initLoop,
  isHiddenError,
  setCause,
  setChain,
  setChainBreak,
  setEvidence,
  setEvidenceGrade,
  setExplain,
  setSelfGrade,
  setTrap,
  submitFirst,
  submitReattempt,
  toAttempt,
} from './model.ts'

const question = {
  id: 'q1',
  answer: 'B',
  skill: 'Inferences',
} as unknown as Question

describe('loop model', () => {
  it('first-try-correct skips the autopsy but still checks evidence', () => {
    let state = initLoop(question, false, 0)
    state = submitFirst(state, 'B', 'sure')
    assert.equal(state.correct, true)
    assert.equal(state.phase, 'evidence') // no cause/explain
    state = setEvidence(state, [0])
    state = setEvidenceGrade(state, 'full')
    assert.equal(state.phase, 'chain')
    state = setChain(state, 0, true)
    assert.equal(state.phase, 'done') // correct answers skip chain-break/trap
  })

  it('flags a correct answer with missed evidence as a hidden error', () => {
    let state = initLoop(question, false, 0)
    state = submitFirst(state, 'B', 'guessing')
    state = setEvidence(state, [])
    state = setEvidenceGrade(state, 'miss')
    assert.equal(isHiddenError(state), true)
    const attempt = toAttempt(state, 'q1', 100)
    assert.equal(attempt.hiddenError, true)
    assert.equal(attempt.correct, true)
  })

  it('routes a wrong-then-trap answer through the full loop', () => {
    let state = initLoop(question, false, 0)
    state = submitFirst(state, 'A', 'sure') // wrong
    assert.equal(state.phase, 'reattempt')
    assert.deepEqual(state.wrongChoices, ['A'])
    state = submitReattempt(state, 'C') // still wrong
    assert.equal(state.phase, 'reattempt')
    assert.deepEqual(state.wrongChoices, ['A', 'C'])
    state = submitReattempt(state, 'B') // correct
    assert.equal(state.phase, 'cause')
    assert.equal(state.attempts, 3)
    state = setCause(state, 'trap')
    state = setExplain(state, 'picked the extreme option', 'B matches the text')
    assert.equal(state.phase, 'self-grade')
    state = setSelfGrade(state, 'partly')
    state = setEvidence(state, [1])
    state = setEvidenceGrade(state, 'partial')
    state = setChain(state, 1, false)
    assert.equal(state.phase, 'chain-break') // wrong answers identify the break
    state = setChainBreak(state, 'question')
    assert.equal(state.phase, 'trap') // cause was a trap
    state = setTrap(state, 'too-extreme')
    assert.equal(state.phase, 'done')

    const attempt = toAttempt(state, 'q1', 200)
    assert.equal(attempt.correct, false)
    assert.equal(attempt.attemptsToCorrect, 3)
    assert.equal(attempt.errorCause, 'trap')
    assert.equal(attempt.trapGuess, 'too-extreme')
    assert.equal(attempt.chainBreakLink, 'question')
    assert.equal(attempt.hiddenError, false)
    assert.equal(attempt.selfExplanations?.selfGrade, 'partly')
  })

  it('a non-trap wrong answer skips the trap step', () => {
    let state = initLoop(question, false, 0)
    state = submitFirst(state, 'A', 'leaning')
    state = submitReattempt(state, 'B')
    state = setCause(state, 'rushed')
    state = setExplain(state, 'read too fast', 'B is the supported claim')
    state = setSelfGrade(state, 'matched')
    state = setEvidence(state, [0])
    state = setEvidenceGrade(state, 'full')
    state = setChain(state, 0, true)
    state = setChainBreak(state, 'answer')
    assert.equal(state.phase, 'done') // no trap step
  })
})
