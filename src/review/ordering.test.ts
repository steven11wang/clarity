import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Question } from '../types.ts'
import { orderedChoices } from './ordering.ts'

const question = {
  id: 'c966ad55',
  choices: { A: 'alpha', B: 'bravo', C: 'charlie', D: 'delta' },
  answer: 'C',
} as unknown as Question

describe('orderedChoices', () => {
  it('is identity order for a first encounter', () => {
    const slots = orderedChoices(question, false)
    assert.deepEqual(
      slots.map((s) => [s.displayLetter, s.sourceLetter]),
      [['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']],
    )
  })

  it('shuffles a resurfacing so the answer moves off its original letter', () => {
    const slots = orderedChoices(question, true)
    const display = slots.map((s) => s.displayLetter)
    const source = slots.map((s) => s.sourceLetter)
    assert.deepEqual(display, ['A', 'B', 'C', 'D']) // labels stay positional
    assert.notDeepEqual(source, ['A', 'B', 'C', 'D']) // underlying order changed
    // Every choice still present exactly once, text follows its source letter.
    assert.deepEqual([...source].sort(), ['A', 'B', 'C', 'D'])
    for (const slot of slots) assert.equal(slot.text, question.choices[slot.sourceLetter])
  })

  it('is stable across calls for the same question (reload-safe)', () => {
    assert.deepEqual(orderedChoices(question, true), orderedChoices(question, true))
  })
})
