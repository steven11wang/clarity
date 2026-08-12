import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { sentenceAt, sentenceSpans } from './sentence.ts'

const paragraph =
  'The committee was ambivalent about the proposal. Dr. Reyes argued for delay. ' +
  'Others wanted a vote that week!'

describe('sentenceAt', () => {
  it('returns the sentence containing the offset', () => {
    assert.equal(
      sentenceAt(paragraph, paragraph.indexOf('ambivalent')),
      'The committee was ambivalent about the proposal.',
    )
  })

  it('does not split on an abbreviation', () => {
    assert.equal(
      sentenceAt(paragraph, paragraph.indexOf('argued')),
      'Dr. Reyes argued for delay.',
    )
  })

  it('keeps the closing terminator with the last sentence', () => {
    assert.equal(
      sentenceAt(paragraph, paragraph.indexOf('vote')),
      'Others wanted a vote that week!',
    )
  })

  it('handles a paragraph with no terminator at all', () => {
    assert.equal(sentenceAt('one long clause with no stop', 4), 'one long clause with no stop')
  })

  it('keeps a quoted terminator inside the sentence', () => {
    const text = 'She called it "a fine mess." The room went quiet.'
    assert.equal(sentenceAt(text, text.indexOf('mess')), 'She called it "a fine mess."')
    assert.equal(sentenceSpans(text).length, 2)
  })
})
