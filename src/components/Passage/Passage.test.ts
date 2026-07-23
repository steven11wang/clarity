import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { segmentSentences } from './sentence.ts'

describe('segmentSentences', () => {
  it('splits punctuation-terminated sentences while keeping punctuation', () => {
    assert.deepEqual(segmentSentences('One. Two? Three!'), ['One.', 'Two?', 'Three!'])
  })

  it('removes whitespace-only fragments', () => {
    assert.deepEqual(segmentSentences('  One.   \n\t Two!    '), ['One.', 'Two!'])
  })

  it('does not split on single-letter initials or abbreviations', () => {
    assert.deepEqual(
      segmentSentences('Translated by A. Christina Albers in 1910. She walked.'),
      ['Translated by A. Christina Albers in 1910.', 'She walked.'],
    )
    assert.deepEqual(segmentSentences('Levels rose 3.5 points, etc. Then they fell.'), [
      'Levels rose 3.5 points, etc. Then they fell.',
    ])
  })
})
