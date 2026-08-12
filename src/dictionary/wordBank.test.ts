import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { REVIEW_INTERVALS_MS, RETIRED_STAGE } from '../review/schedule.ts'
import {
  applyRecall,
  clozeSentence,
  createWordEntry,
  dueWords,
  sortWords,
  wordCounts,
  wordStatus,
  type WordBankEntry,
} from './wordBank.ts'

const NOW = 1_700_000_000_000

function entry(overrides: Partial<WordBankEntry> = {}): WordBankEntry {
  return {
    ...createWordEntry(
      {
        id: 'ambivalent',
        word: 'ambivalent',
        partOfSpeech: 'adjective',
        definition: 'Having mixed feelings about something.',
        sentence: 'The committee was ambivalent about the proposal.',
      },
      false,
      NOW,
    ),
    ...overrides,
  }
}

describe('createWordEntry', () => {
  it('files a new word at the first rung of the ladder', () => {
    const word = entry()
    assert.equal(word.stage, 0)
    assert.equal(word.clears, 0)
    assert.equal(word.dueAt, NOW + REVIEW_INTERVALS_MS[0])
    assert.equal(word.sentence, 'The committee was ambivalent about the proposal.')
  })
})

describe('applyRecall', () => {
  it('advances a rung when the word is remembered', () => {
    const next = applyRecall(entry(), true, false, NOW)
    assert.equal(next.stage, 1)
    assert.equal(next.clears, 1)
    assert.equal(next.dueAt, NOW + REVIEW_INTERVALS_MS[1])
  })

  it('retires the word after the last rung', () => {
    const last = entry({ stage: REVIEW_INTERVALS_MS.length - 1, clears: 3 })
    const next = applyRecall(last, true, false, NOW)
    assert.equal(next.stage, RETIRED_STAGE)
    assert.equal(wordStatus(next, NOW), 'retired')
  })

  it('restarts the ladder and counts a lapse when the word is forgotten', () => {
    const advanced = entry({ stage: 2, clears: 2 })
    const next = applyRecall(advanced, false, false, NOW)
    assert.equal(next.stage, 0)
    assert.equal(next.clears, 0)
    assert.equal(next.lapses, 1)
    assert.equal(next.dueAt, NOW + REVIEW_INTERVALS_MS[0])
  })

  it('keeps a retired word retired', () => {
    const retired = entry({ stage: RETIRED_STAGE })
    assert.equal(applyRecall(retired, true, false, NOW).stage, RETIRED_STAGE)
  })
})

describe('the bank view', () => {
  const due = entry({ id: 'due', word: 'due', dueAt: NOW - 1000 })
  const laterDue = entry({ id: 'later', word: 'later', dueAt: NOW - 10 })
  const scheduled = entry({ id: 'scheduled', word: 'scheduled', dueAt: NOW + 5000 })
  const retired = entry({ id: 'retired', word: 'retired', stage: RETIRED_STAGE })
  const all = [scheduled, retired, laterDue, due]

  it('sorts due words first, oldest debt first', () => {
    assert.deepEqual(
      sortWords(all, NOW).map((word) => word.id),
      ['due', 'later', 'scheduled', 'retired'],
    )
  })

  it('counts each drawer', () => {
    assert.deepEqual(wordCounts(all, NOW), { due: 2, scheduled: 1, retired: 1 })
  })

  it('hands back only the due words for a drill', () => {
    assert.deepEqual(dueWords(all, NOW).map((word) => word.id), ['due', 'later'])
  })
})

describe('clozeSentence', () => {
  it('blanks the saved word out of its sentence', () => {
    assert.equal(
      clozeSentence(entry()),
      'The committee was ______ about the proposal.',
    )
  })

  it('leaves the sentence alone when the word is not in it', () => {
    const word = entry({ sentence: 'A sentence without the saved form.' })
    assert.equal(clozeSentence(word), 'A sentence without the saved form.')
  })
})
