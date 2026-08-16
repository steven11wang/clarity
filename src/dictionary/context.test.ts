import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveChoiceContext } from './context.ts'

describe('resolveChoiceContext', () => {
  it('substitutes single-word choices into passage fill-in-the-blank sentences', () => {
    const passage =
      'The committee was ______ about the proposal. Its members requested additional research.'
    const result = resolveChoiceContext({
      choiceText: 'ambivalent',
      word: 'ambivalent',
      requestSentence: 'ambivalent',
      passage,
      prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
    })
    assert.equal(result, 'The committee was ambivalent about the proposal.')
  })

  it('substitutes choice phrases into passage fill-in-the-blank sentences when passage is string array', () => {
    const passage = [
      'First paragraph of passage.',
      'The ancient artifact proved to be a ______ discovery for the field of archaeology.',
    ]
    const result = resolveChoiceContext({
      choiceText: 'transformative',
      word: 'transformative',
      requestSentence: 'transformative',
      passage,
      prompt: 'Which choice completes the text?',
    })
    assert.equal(
      result,
      'The ancient artifact proved to be a transformative discovery for the field of archaeology.',
    )
  })

  it('preserves choice text if the choice itself is already a full sentence', () => {
    const fullChoice =
      'It demonstrates that the author was skeptical of the findings presented in the study.'
    const result = resolveChoiceContext({
      choiceText: fullChoice,
      word: 'skeptical',
      requestSentence: fullChoice,
      passage: 'Some passage text.',
      prompt: 'Which statement best describes the function of the second paragraph?',
    })
    assert.equal(result, fullChoice)
  })

  it('combines prompt and choice when passage has no blank marker', () => {
    const result = resolveChoiceContext({
      choiceText: 'omnipresent',
      word: 'omnipresent',
      requestSentence: 'omnipresent',
      prompt: 'Which choice best describes the central theme?',
    })
    assert.equal(result, 'Which choice best describes the central theme: omnipresent.')
  })
})
