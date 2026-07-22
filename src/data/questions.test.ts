import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'

import { loadQuestions } from './questions.ts'

describe('loadQuestions', () => {
  afterEach(() => {
    mock.restoreAll()
  })

  it('requests the single questions data path and returns its questions', async () => {
    const questions = [{ id: 'question-1' }]
    const fetchMock = mock.fn(async () => ({ ok: true, json: async () => questions }))
    mock.method(globalThis, 'fetch', fetchMock)

    assert.deepEqual(await loadQuestions(), questions)
    assert.equal(fetchMock.mock.calls.length, 1)
    assert.deepEqual(fetchMock.mock.calls[0].arguments, ['/data/questions.json'])
  })

  it('rejects an unsuccessful response', async () => {
    mock.method(globalThis, 'fetch', async () => ({ ok: false }) as Response)

    await assert.rejects(loadQuestions(), /Unable to load questions/)
  })
})
