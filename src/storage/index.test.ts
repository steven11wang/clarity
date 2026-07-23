import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import type { Attempt } from '../types.ts'
import { recordAttempt, storage } from './index.ts'

class MemoryStorage implements Storage {
  #values = new Map<string, string>()

  get length() {
    return this.#values.size
  }

  clear() { this.#values.clear() }
  getItem(key: string) { return this.#values.get(key) ?? null }
  key(index: number) { return [...this.#values.keys()][index] ?? null }
  removeItem(key: string) { this.#values.delete(key) }
  setItem(key: string, value: string) { this.#values.set(key, value) }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
})

const attempt: Attempt = {
  questionId: 'question-1',
  timestamp: 1,
  chosen: 'A',
  correct: true,
  confidence: 'sure',
  attemptsToCorrect: 1,
  errorCause: null,
  selfExplanations: null,
  evidenceUnderlined: [],
  evidenceScore: null,
  chainBreakLink: null,
  trapGuess: null,
  trapActual: null,
  hiddenError: false,
  resurrectionStage: 0,
  timeSpentMs: null,
  timedOut: false,
}

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores and returns values in the versioned clarity namespace only', () => {
    localStorage.setItem('other-app:settings', JSON.stringify({ theme: 'dark' }))

    storage.set('settings', { theme: 'light' })

    assert.equal(localStorage.getItem('clarity:v1:settings'), JSON.stringify({ theme: 'light' }))
    assert.deepEqual(storage.get<{ theme: string }>('settings'), { theme: 'light' })
    assert.equal(storage.get('other-app:settings'), null)
  })

  it('lists only matching namespaced values and preserves the schema version', () => {
    localStorage.setItem('clarity:schema-version', '1')
    storage.set('attempts:one', { questionId: 'one' })
    storage.set('attempts:two', { questionId: 'two' })
    storage.set('settings', { theme: 'light' })
    localStorage.setItem('other-app:attempts:three', JSON.stringify({ questionId: 'three' }))

    assert.deepEqual(storage.list<{ questionId: string }>('attempts:'), [
      { questionId: 'one' },
      { questionId: 'two' },
    ])
    assert.equal(localStorage.getItem('clarity:schema-version'), '1')
  })

  it('writes attempt records through namespaced storage', () => {
    recordAttempt(attempt)

    assert.deepEqual(storage.list<Attempt>('attempts:'), [attempt])
  })
})
