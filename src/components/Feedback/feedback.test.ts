import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/app/' })
const globals = globalThis as unknown as Record<string, unknown>
globals.window = dom.window
globals.localStorage = dom.window.localStorage

const { sendFeedback, FEEDBACK_MAX_LENGTH } = await import('./feedback.ts')

const base = { view: 'practice', userId: null, email: 'a@b.co', displayName: 'ab' }

describe('sendFeedback', () => {
  beforeEach(() => dom.window.localStorage.clear())

  it('refuses an empty note', async () => {
    const result = await sendFeedback({ ...base, message: '   ' })
    assert.equal(result.ok, false)
    assert.equal(dom.window.localStorage.getItem('clarity-feedback-outbox'), null)
  })

  it('refuses a note that is too long', async () => {
    const result = await sendFeedback({ ...base, message: 'x'.repeat(FEEDBACK_MAX_LENGTH + 1) })
    assert.equal(result.ok, false)
  })

  it('keeps the note on this device when there is no cloud account, with its context', async () => {
    const result = await sendFeedback({ ...base, message: '  The timer froze.  ' })
    assert.deepEqual(result, { ok: true, saved: 'device' })

    const saved = JSON.parse(dom.window.localStorage.getItem('clarity-feedback-outbox') ?? '[]')
    assert.equal(saved.length, 1)
    assert.equal(saved[0].message, 'The timer froze.')
    assert.equal(saved[0].view, 'practice')
    assert.equal(saved[0].page_url, '/app/')
    assert.equal(saved[0].email, 'a@b.co')
  })
})
