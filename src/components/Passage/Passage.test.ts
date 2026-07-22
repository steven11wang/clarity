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
})
