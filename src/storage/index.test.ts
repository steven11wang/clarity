import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { createProgressionState } from '../progression/model.ts'
import type { QuestionTaxonomy } from '../progression/questions.ts'
import type { Attempt } from '../types.ts'
import {
  clearAdaptiveDraft,
  deleteExamRecord,
  exportAllData,
  getActiveView,
  getAdaptiveDraft,
  getAttempts,
  getExamRecord,
  getExamRecords,
  getProgression,
  getReviews,
  getWordBankEntries,
  importAllData,
  recordAttempt,
  replaceCloudState,
  saveAdaptiveDraft,
  saveExamRecord,
  saveProgression,
  saveWord,
  setActiveView,
  storage,
  type PracticeExamRecord,
} from './index.ts'
import type { WordBankEntry } from '../dictionary/wordBank.ts'

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

  it('enriches an adaptive miss after review without counting it twice', () => {
    const adaptiveMiss: Attempt = {
      ...attempt,
      correct: false,
      attemptsToCorrect: 0,
      activityId: 'skill:Information and Ideas:Inferences:Noobie:0',
      activityKind: 'skill',
      practiceLevel: 'Noobie',
    }
    recordAttempt(adaptiveMiss)
    recordAttempt({
      ...adaptiveMiss,
      attemptsToCorrect: 2,
      errorCause: 'trap',
      selfExplanations: {
        whyWrong: 'It was too extreme or absolute',
        whyRight: '',
        selfGrade: 'matched',
      },
      evidenceUnderlined: [1],
      evidenceScore: 'full',
      chainBreakLink: 'answer',
      trapGuess: 'too-extreme',
    })

    const attempts = getAttempts()
    assert.equal(attempts.length, 1)
    assert.equal(attempts[0].attemptsToCorrect, 2)
    assert.equal(attempts[0].errorCause, 'trap')
    assert.deepEqual(attempts[0].evidenceUnderlined, [1])
  })

  it('restores the complete adaptive progression document after a reload', () => {
    const taxonomy: QuestionTaxonomy = {
      'Information and Ideas': ['Inferences'],
      'Craft and Structure': ['Words in Context'],
      'Expression of Ideas': ['Transitions'],
      'Standard English Conventions': ['Boundaries'],
    }
    const progression = createProgressionState(
      {
        'Information and Ideas': 'Easy',
        'Craft and Structure': 'Medium',
        'Expression of Ideas': 'Hard',
        'Standard English Conventions': 'Medium',
      },
      taxonomy,
      'score-report.png',
      123,
    )
    progression.domains['Information and Ideas'].skills.Inferences.levels.Noobie.completed = true

    saveProgression(progression)

    assert.deepEqual(getProgression(), progression)
    assert.equal(
      localStorage.getItem('clarity:v1:progression'),
      JSON.stringify(progression),
    )
  })

  it('restores and clears an in-progress adaptive assessment draft', () => {
    const draft = {
      schemaVersion: 1 as const,
      progressionConfirmedAt: 123,
      assessment: {
        kind: 'skill' as const,
        id: 'skill:Information and Ideas:Inferences:Noobie:0',
        domain: 'Information and Ideas' as const,
        skill: 'Inferences',
        level: 'Noobie' as const,
        purpose: 'training' as const,
        questionIds: ['q1', 'q2', 'q3'],
        reusedCount: 0,
      },
      answers: { q1: 'A' },
    }

    saveAdaptiveDraft(draft)
    assert.deepEqual(getAdaptiveDraft(), draft)

    clearAdaptiveDraft()
    assert.equal(getAdaptiveDraft(), null)
  })

  it('atomically restores cloud progress while keeping device-only settings', () => {
    storage.set('settings', { demoMode: true })
    storage.set('attempts:old', { ...attempt, questionId: 'old' })
    const remoteAttempt = { ...attempt, questionId: 'remote', timestamp: 42 }
    const remoteWord: WordBankEntry = {
      id: 'ephemeral',
      word: 'ephemeral',
      partOfSpeech: 'adjective',
      definition: 'lasting for a very short time',
      sentence: 'The ephemeral beauty of morning mist',
      source: null,
      savedAt: 100,
      stage: 0,
      dueAt: 200,
      clears: 0,
      lapses: 0,
      lastReviewedAt: null,
    }

    replaceCloudState({
      progression: null,
      attempts: [remoteAttempt],
      reviews: {
        remote: {
          questionId: 'remote',
          createdAt: 10,
          dueAt: 20,
          stage: 0,
          reason: 'miss',
          clears: 0,
          lastReviewedAt: null,
        },
      },
      wordBank: {
        ephemeral: remoteWord,
      },
    })

    assert.deepEqual(getAttempts(), [remoteAttempt])
    assert.deepEqual(getReviews().remote?.questionId, 'remote')
    assert.deepEqual(getWordBankEntries(), [remoteWord])
    assert.deepEqual(storage.get('settings'), { demoMode: true })
  })

  it('stores, lists, finds, and deletes practice exam records in order', () => {
    const record1: PracticeExamRecord = {
      id: 'exam_record_100_mock',
      examId: 'mock',
      examTitle: 'Mock Exam 1',
      finishedAt: 100,
      result: {
        answers: { q1: 'A' },
        flagged: [],
        finishedAt: 100,
        timeLeft: {},
        overtime: {},
        questionSeconds: {},
        untimed: false,
        timingLabel: 'Official pace',
      },
    }
    const record2: PracticeExamRecord = {
      id: 'exam_record_200_mock',
      examId: 'mock',
      examTitle: 'Mock Exam 1',
      finishedAt: 200,
      result: {
        answers: { q1: 'B' },
        flagged: [],
        finishedAt: 200,
        timeLeft: {},
        overtime: {},
        questionSeconds: {},
        untimed: true,
        timingLabel: 'Untimed',
      },
    }

    saveExamRecord(record1)
    saveExamRecord(record2)

    const list = getExamRecords()
    assert.equal(list.length, 2)
    assert.equal(list[0].finishedAt, 200) // Newest first
    assert.equal(list[1].finishedAt, 100)

    assert.deepEqual(getExamRecord('exam_record_100_mock'), record1)

    deleteExamRecord('exam_record_100_mock')
    assert.equal(getExamRecords().length, 1)
    assert.equal(getExamRecord('exam_record_100_mock'), null)
  })

  it('persists and retrieves the active tab view', () => {
    assert.equal(getActiveView(), null)
    setActiveView('exam')
    assert.equal(getActiveView(), 'exam')
  })

  it('exports and imports complete application state cleanly', () => {
    saveWord({
      id: 'ephemeral',
      word: 'ephemeral',
      partOfSpeech: 'adjective',
      definition: 'short-lived',
      sentence: 'test sentence',
      source: null,
      savedAt: 100,
      stage: 0,
      dueAt: 200,
      clears: 0,
      lapses: 0,
      lastReviewedAt: null,
    })
    recordAttempt(attempt)

    const record: PracticeExamRecord = {
      id: 'exam_record_500_test',
      examId: 'test-exam',
      examTitle: 'Test Exam',
      finishedAt: 500,
      result: {
        answers: { q1: 'A' },
        flagged: [],
        finishedAt: 500,
        timeLeft: {},
        overtime: {},
        questionSeconds: {},
        untimed: true,
        timingLabel: 'Untimed',
      },
    }
    saveExamRecord(record)

    const backup = exportAllData()
    assert.equal(backup.version, 1)
    assert.equal(backup.attempts.length, 1)
    assert.equal(backup.examRecords.length, 1)
    assert.equal(backup.wordBank.ephemeral.word, 'ephemeral')

    // Wipe storage
    localStorage.clear()

    // Restore from backup
    importAllData(backup)

    assert.equal(getAttempts().length, 1)
    assert.equal(getWordBankEntries().length, 1)
    assert.equal(getExamRecords().length, 1)
    assert.equal(getExamRecord('exam_record_500_test')?.examTitle, 'Test Exam')
  })
})

