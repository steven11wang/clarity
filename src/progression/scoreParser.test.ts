import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MAX_SCORE_SCREENSHOT_BYTES,
  manualScoreParser,
  validateScoreScreenshot,
} from './scoreParser.ts'

function imageFile(
  type = 'image/png',
  size = 1024,
  name = 'score.png',
): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('score screenshot intake', () => {
  it('accepts supported non-empty screenshots within the size limit', () => {
    assert.equal(validateScoreScreenshot(imageFile()), null)
    assert.equal(validateScoreScreenshot(imageFile('image/jpeg')), null)
    assert.equal(validateScoreScreenshot(imageFile('image/webp')), null)
  })

  it('rejects unsupported, empty, and oversized uploads', () => {
    assert.match(
      validateScoreScreenshot(imageFile('application/pdf')) ?? '',
      /PNG, JPEG, or WebP/,
    )
    assert.match(
      validateScoreScreenshot(imageFile('image/png', 0)) ?? '',
      /empty/,
    )
    assert.match(
      validateScoreScreenshot(
        imageFile('image/png', MAX_SCORE_SCREENSHOT_BYTES + 1),
      ) ?? '',
      /10 MB or smaller/,
    )
  })

  it('uses an explicit manual confirmation result when OCR is unavailable', async () => {
    const result = await manualScoreParser.parse(imageFile())

    assert.equal(result.kind, 'manual-required')
    assert.deepEqual(result.results, {})
    assert.equal(result.uncertainDomains?.length, 4)
    assert.match(result.message, /not connected yet/)
  })
})
