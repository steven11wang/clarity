import type { Attempt, ReviewItem } from '../types.ts'
import type { WordBankEntry } from '../dictionary/wordBank.ts'
import type { DeckCard } from '../review/deckScheduler.ts'
import type { DeckReview } from '../review/deckQueue.ts'
import { normalizeDailyState, type DailyState } from '../review/daily.ts'
import type { ProgressionState } from '../progression/model.ts'
import type { Level, SatDomain } from '../progression/config.ts'
import type { SkillQuizPurpose } from '../progression/model.ts'
import type { ExamResult } from '../components/Exam/ExamRunner.tsx'

export type PracticeExamRecord = {
  id: string
  examId: string
  examTitle: string
  finishedAt: number
  result: ExamResult
}


const STORAGE_PREFIX = 'clarity:v1:'
const STORAGE_CHANGE_EVENT = 'clarity:storage-change'
let suppressChangeEvents = false

function namespacedKey(key: string) {
  return `${STORAGE_PREFIX}${key}`
}

function parseValue<T>(value: string | null): T | null {
  if (value === null) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function notifyStorageChange(key: string) {
  if (!suppressChangeEvents && typeof window !== 'undefined') {
    const CustomEventCtor = window.CustomEvent || CustomEvent
    window.dispatchEvent(new CustomEventCtor(STORAGE_CHANGE_EVENT, { detail: { key } }))
  }
}

export const storage = {
  get<T>(key: string): T | null {
    return parseValue<T>(localStorage.getItem(namespacedKey(key)))
  },

  set<T>(key: string, value: T): void {
    localStorage.setItem(namespacedKey(key), JSON.stringify(value))
    notifyStorageChange(key)
  },

  remove(key: string): void {
    localStorage.removeItem(namespacedKey(key))
    notifyStorageChange(key)
  },

  list<T>(prefix: string): T[] {
    const values: T[] = []
    const keyPrefix = namespacedKey(prefix)

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(keyPrefix)) {
        const value = parseValue<T>(localStorage.getItem(key))
        if (value !== null) {
          values.push(value)
        }
      }
    }

    return values
  },
}

// --- Attempts ---------------------------------------------------------------

export function recordAttempt(attempt: Attempt): void {
  storage.set(`attempts:${attempt.timestamp}:${attempt.questionId}`, attempt)
}

export function getAttempts(): Attempt[] {
  return storage
    .list<Attempt>('attempts:')
    .sort((a, b) => a.timestamp - b.timestamp)
}

// --- Practice Exam Records ---------------------------------------------------

const EXAM_RECORDS_PREFIX = 'exam-records:'

export const RECOVERED_COOKSAT_EXAM_RECORD: PracticeExamRecord = {

  id: 'exam_record_1786236300000_cooksat-mock-exam-2',
  examId: 'cooksat-mock-exam-2',
  examTitle: 'CookSAT Mock Exam 2',
  finishedAt: 1786236300000,
  result: {
    answers: {
      'module-1-q1': 'B',
      'module-1-q2': 'C',
      'module-1-q3': 'C',
      'module-1-q4': 'A',
      'module-1-q5': 'B',
      'module-1-q6': 'B',
      'module-1-q7': 'B',
      'module-1-q8': 'D',
      'module-1-q9': 'B',
      'module-1-q10': 'B',
      'module-1-q11': 'A',
      'module-1-q12': 'C',
      'module-1-q13': 'C',
      'module-1-q14': 'D',
      'module-1-q15': 'D',
      'module-1-q16': 'A',
      'module-1-q17': 'C',
      'module-1-q18': 'A',
      'module-1-q19': 'D',
      'module-1-q20': 'A',
      'module-1-q21': 'C',
      'module-1-q22': 'D',
      'module-1-q23': 'D',
      'module-1-q24': 'A',
      'module-1-q25': 'D',
      'module-1-q26': 'C',
      'module-1-q27': 'A',
      'module-2-q1': 'D',
      'module-2-q2': 'A',
      'module-2-q3': 'D',
      'module-2-q4': 'D',
      'module-2-q5': 'B',
      'module-2-q6': 'C',
      'module-2-q7': 'B',
      'module-2-q8': 'A',
      'module-2-q9': 'D',
      'module-2-q10': 'A',
      'module-2-q11': 'B',
      'module-2-q12': 'D',
      'module-2-q13': 'D',
      'module-2-q14': 'B',
      'module-2-q15': 'B',
      'module-2-q16': 'A',
      'module-2-q17': 'D',
      'module-2-q18': 'A',
      'module-2-q19': 'A',
      'module-2-q20': 'A',
      'module-2-q21': 'C',
      'module-2-q22': 'D',
      'module-2-q23': 'B',
      'module-2-q24': 'B',
      'module-2-q25': 'A',
      'module-2-q26': 'C',
      'module-2-q27': 'B',
    },
    flagged: [
      'module-1-q21',
      'module-2-q1',
      'module-2-q3',
      'module-2-q5',
      'module-2-q6',
      'module-2-q7',
      'module-2-q9',
      'module-2-q13',
      'module-2-q16',
      'module-2-q17',
      'module-2-q18',
      'module-2-q19',
    ],
    finishedAt: 1786236300000,
    timeLeft: { 'module-1': 0, 'module-2': 0 },
    overtime: { 'module-1': 3928, 'module-2': 6024 },
    questionSeconds: {
      'module-1-q1': 38,
      'module-1-q2': 155,
      'module-1-q3': 109,
      'module-1-q4': 149,
      'module-1-q5': 260,
      'module-1-q6': 147,
      'module-1-q7': 188,
      'module-1-q8': 151,
      'module-1-q9': 467,
      'module-1-q10': 246,
      'module-1-q11': 194,
      'module-1-q12': 161,
      'module-1-q13': 127,
      'module-1-q14': 251,
      'module-1-q15': 169,
      'module-1-q16': 18,
      'module-1-q17': 19,
      'module-1-q18': 17,
      'module-1-q19': 59,
      'module-1-q20': 37,
      'module-1-q21': 183,
      'module-1-q22': 298,
      'module-1-q23': 64,
      'module-1-q24': 26,
      'module-1-q25': 36,
      'module-1-q26': 85,
      'module-1-q27': 272,
      'module-2-q1': 300,
      'module-2-q2': 358,
      'module-2-q3': 164,
      'module-2-q4': 36,
      'module-2-q5': 374,
      'module-2-q6': 351,
      'module-2-q7': 338,
      'module-2-q8': 285,
      'module-2-q9': 947,
      'module-2-q10': 101,
      'module-2-q11': 487,
      'module-2-q12': 353,
      'module-2-q13': 612,
      'module-2-q14': 436,
      'module-2-q15': 17,
      'module-2-q16': 129,
      'module-2-q17': 131,
      'module-2-q18': 55,
      'module-2-q19': 42,
      'module-2-q20': 199,
      'module-2-q21': 31,
      'module-2-q22': 20,
      'module-2-q23': 93,
      'module-2-q24': 51,
      'module-2-q25': 34,
      'module-2-q26': 39,
      'module-2-q27': 37,
    },
    untimed: true,
    timingLabel: 'Untimed',
    fixedMisses: {
      'module-1-q3': true,
      'module-1-q21': true,
      'module-2-q1': true,
      'module-2-q3': true,
      'module-2-q5': true,
      'module-2-q6': true,
      'module-2-q7': true,
      'module-2-q9': true,
      'module-2-q13': true,
    },
  },
}

const SEEDED_KEY = 'exam-records-seeded'

export function saveExamRecord(record: PracticeExamRecord): void {
  storage.set(SEEDED_KEY, true)
  storage.set(`${EXAM_RECORDS_PREFIX}${record.finishedAt}:${record.examId}`, record)
}


export function getExamRecords(): PracticeExamRecord[] {
  const records = storage.list<PracticeExamRecord>(EXAM_RECORDS_PREFIX)
  if (records.length === 0 && !storage.get<boolean>(SEEDED_KEY)) {
    storage.set(SEEDED_KEY, true)
    saveExamRecord(RECOVERED_COOKSAT_EXAM_RECORD)
    return [RECOVERED_COOKSAT_EXAM_RECORD]
  }
  return records.sort((a, b) => b.finishedAt - a.finishedAt)
}

export function getExamRecord(id: string): PracticeExamRecord | null {
  return getExamRecords().find((r) => r.id === id) ?? null
}

export function deleteExamRecord(id: string): void {
  storage.set(SEEDED_KEY, true)
  const records = getExamRecords()
  const match = records.find((r) => r.id === id)
  if (match) {
    storage.remove(`${EXAM_RECORDS_PREFIX}${match.finishedAt}:${match.examId}`)
  }
}



// --- Review queue (resurrection) --------------------------------------------
// Stored as a single map keyed by questionId so a question has at most one
// scheduled resurfacing at a time.

const REVIEWS_KEY = 'reviews'

export function getReviews(): Record<string, ReviewItem> {
  return storage.get<Record<string, ReviewItem>>(REVIEWS_KEY) ?? {}
}

export function getReview(questionId: string): ReviewItem | null {
  return getReviews()[questionId] ?? null
}

export function saveReview(item: ReviewItem): void {
  const reviews = getReviews()
  reviews[item.questionId] = item
  storage.set(REVIEWS_KEY, reviews)
}

// --- Adaptive progression --------------------------------------------------
// Kept as one versioned document so every guarded state-machine transition is
// persisted atomically. Loading/normalization lives in progression/model.ts.

const PROGRESSION_KEY = 'progression'

export function getProgression(): ProgressionState | null {
  return storage.get<ProgressionState>(PROGRESSION_KEY)
}

export function saveProgression(state: ProgressionState): void {
  storage.set(PROGRESSION_KEY, state)
}

// --- First-entry study path -----------------------------------------------
// This is device-local setup context rather than earned progress. Keeping it
// per profile prevents one learner's onboarding choice from hiding the flow
// for another learner who uses the same device.

export type StudyPathStartingStep = 1 | 2 | 5

export type StudyPathOnboardingState = {
  hasTakenPracticeTest: true
  startingStep: StudyPathStartingStep
  completedAt: number
}

const STUDY_PATH_KEY = 'study-path-onboarding'

function studyPathKey(profileId: string | null | undefined) {
  return `${STUDY_PATH_KEY}:${profileId || 'anonymous'}`
}

export function getStudyPathOnboarding(
  profileId?: string | null,
): StudyPathOnboardingState | null {
  const value = storage.get<Partial<StudyPathOnboardingState>>(
    studyPathKey(profileId),
  )
  if (
    value?.hasTakenPracticeTest !== true ||
    (value.startingStep !== 1 &&
      value.startingStep !== 2 &&
      value.startingStep !== 5) ||
    typeof value.completedAt !== 'number'
  ) {
    return null
  }
  return value as StudyPathOnboardingState
}

export function saveStudyPathOnboarding(
  profileId: string | null | undefined,
  state: StudyPathOnboardingState,
): void {
  storage.set(studyPathKey(profileId), state)
}

// --- In-progress adaptive assessment ---------------------------------------
// Kept separately from the guarded progression document: it is a resumable UI
// draft, not earned progress. The progression timestamp + deterministic
// assessment ID let the UI reject a stale draft after a transition.

export type AdaptiveAssessmentDraft = {
  schemaVersion: 1
  progressionConfirmedAt: number
  assessment:
    | {
        kind: 'diagnostic'
        id: string
        domain: SatDomain
        level: Level
        questionIds: string[]
        reusedCount: number
      }
    | {
        kind: 'skill'
        id: string
        domain: SatDomain
        skill: string
        level: Level
        purpose: SkillQuizPurpose
        questionIds: string[]
        reusedCount: number
      }
    | {
        kind: 'checkpoint'
        id: string
        domain: SatDomain
        level: 'Adventurer' | 'Master'
        questionIds: string[]
        reusedCount: number
      }
  answers: Record<string, string>
}

const ADAPTIVE_DRAFT_KEY = 'adaptive-draft'

export function getAdaptiveDraft(): AdaptiveAssessmentDraft | null {
  return storage.get<AdaptiveAssessmentDraft>(ADAPTIVE_DRAFT_KEY)
}

export function saveAdaptiveDraft(draft: AdaptiveAssessmentDraft): void {
  storage.set(ADAPTIVE_DRAFT_KEY, draft)
}

export function clearAdaptiveDraft(): void {
  storage.remove(ADAPTIVE_DRAFT_KEY)
}

// --- In-progress practice exam ---------------------------------------------

export type PracticeExamDraft = {
  examId: string
  paceId: string
  customMinutes: number
  moduleIndex: number
  questionIndex: number
  screen: 'module-intro' | 'question' | 'review'
  answers: Record<string, string>
  flagged: Record<string, boolean>
  crossOuts: Record<string, string[]>
  highlights: Record<string, number[]>
  timeLeft: Record<string, number>
  overtimeLog: Record<string, number>
  questionSeconds: Record<string, number>
  secondsLeft: number
  extraSeconds: number
  overtimeMode: boolean
  updatedAt: number
}

const PRACTICE_EXAM_DRAFT_PREFIX = 'exam-draft:'

export function getPracticeExamDraft(examId: string): PracticeExamDraft | null {
  return storage.get<PracticeExamDraft>(`${PRACTICE_EXAM_DRAFT_PREFIX}${examId}`)
}

export function savePracticeExamDraft(draft: PracticeExamDraft): void {
  storage.set(`${PRACTICE_EXAM_DRAFT_PREFIX}${draft.examId}`, draft)
}

export function clearPracticeExamDraft(examId: string): void {
  storage.remove(`${PRACTICE_EXAM_DRAFT_PREFIX}${examId}`)
}

// --- Active view persistence -----------------------------------------------

const ACTIVE_VIEW_KEY = 'active-view'

export function getActiveView<T extends string = string>(): T | null {
  return storage.get<T>(ACTIVE_VIEW_KEY)
}

export function setActiveView(view: string): void {
  storage.set(ACTIVE_VIEW_KEY, view)
}

// --- Foundations lessons ----------------------------------------------------
// Which skill lessons the student has already been walked through. Kept out of
// the progression document on purpose: reading a lesson is not earned progress,
// so it must never participate in a guarded state transition, and wiping
// progress to retake a diagnostic shouldn't force a reread of every lesson.

const LESSONS_SEEN_KEY = 'lessons-seen'

type LessonsSeen = Record<string, number>

export function getLessonsSeen(): LessonsSeen {
  return storage.get<LessonsSeen>(LESSONS_SEEN_KEY) ?? {}
}

export function hasSeenLesson(skill: string): boolean {
  return Boolean(getLessonsSeen()[skill])
}

export function markLessonSeen(skill: string, timestamp = Date.now()): void {
  const seen = getLessonsSeen()
  if (seen[skill]) return
  seen[skill] = timestamp
  storage.set(LESSONS_SEEN_KEY, seen)
}

// --- Word bank --------------------------------------------------------------
// Words looked up in a passage and kept, stored as one map keyed by the
// normalized word so saving the same word twice updates its card rather than
// filing a duplicate.

const WORD_BANK_KEY = 'word-bank'

export function getWordBank(): Record<string, WordBankEntry> {
  return storage.get<Record<string, WordBankEntry>>(WORD_BANK_KEY) ?? {}
}

export function getWordBankEntries(): WordBankEntry[] {
  return Object.values(getWordBank())
}

export function saveWord(entry: WordBankEntry): void {
  storage.set(WORD_BANK_KEY, { ...getWordBank(), [entry.id]: entry })
}

export function removeWord(id: string): void {
  const bank = getWordBank()
  if (!(id in bank)) return
  delete bank[id]
  storage.set(WORD_BANK_KEY, bank)
}

export function isWordSaved(id: string): boolean {
  return id in getWordBank()
}

// --- Learning decks ---------------------------------------------------------
// The two shipped vocabulary decks run Anki's scheduler, so what is stored is
// what Anki stores: one row of scheduling state per card, and a review log of
// every button ever pressed. The log is what the analysis screen is drawn from
// - counts alone can say where a card is, but only the log can say how the
// learner got it there.

const DECK_CARDS_KEY = 'word-deck-cards'
const DECK_REVLOG_KEY = 'word-deck-revlog'

/** A year of button presses is plenty for every graph on the analysis screen. */
const DECK_REVLOG_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000
/** A hard ceiling as well, so a runaway session can't fill the storage quota. */
const DECK_REVLOG_LIMIT = 20000

export function getDeckCards(): Record<string, DeckCard> {
  return storage.get<Record<string, DeckCard>>(DECK_CARDS_KEY) ?? {}
}

export function saveDeckCard(card: DeckCard): void {
  storage.set(DECK_CARDS_KEY, { ...getDeckCards(), [card.id]: card })
}

export function getDeckReviews(): DeckReview[] {
  return storage.get<DeckReview[]>(DECK_REVLOG_KEY) ?? []
}

/**
 * File a button press. Trimming happens on write rather than on read so the
 * analysis screen never pays for it, and old entries are dropped by age first
 * so the graphs lose their tail rather than their most recent day.
 */
export function appendDeckReview(entry: DeckReview): void {
  const cutoff = entry.at - DECK_REVLOG_MAX_AGE_MS
  const log = [...getDeckReviews().filter((row) => row.at >= cutoff), entry]
  storage.set(DECK_REVLOG_KEY, log.slice(-DECK_REVLOG_LIMIT))
}

/** Forget one deck entirely - its cards go back to unseen, its log is dropped. */
export function resetDeck(deckId: string): void {
  const cards = getDeckCards()
  for (const id of Object.keys(cards)) {
    if (cards[id].deckId === deckId) delete cards[id]
  }
  storage.set(DECK_CARDS_KEY, cards)
  storage.set(
    DECK_REVLOG_KEY,
    getDeckReviews().filter((entry) => entry.deckId !== deckId),
  )
}

// --- Daily return ------------------------------------------------------------
// Which day the briefing was last shown and last finished, plus the streak.
// Device-local on purpose: it records when you sat down, not what you know, so
// restoring a cloud snapshot from another machine must not overwrite it.

const DAILY_KEY = 'daily-review'

export function getDailyState(): DailyState {
  return normalizeDailyState(storage.get<Partial<DailyState>>(DAILY_KEY))
}

export function saveDailyState(state: DailyState): void {
  storage.set(DAILY_KEY, state)
}

// --- Dev settings -----------------------------------------------------------
// demoMode compresses review intervals to seconds; clockOffset lets the demo
// jump forward in time so scheduled items come due without waiting.

type Settings = {
  demoMode: boolean
  clockOffset: number
  timedMode: boolean
  timeLimitSec: number
}

const DEFAULT_SETTINGS: Settings = {
  demoMode: false,
  clockOffset: 0,
  timedMode: false,
  timeLimitSec: 90,
}

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...(storage.get<Partial<Settings>>('settings') ?? {}) }
}

export function setDemoMode(demoMode: boolean): void {
  storage.set('settings', { ...getSettings(), demoMode })
}

export function setTimedMode(timedMode: boolean): void {
  storage.set('settings', { ...getSettings(), timedMode })
}

export function setTimeLimit(timeLimitSec: number): void {
  storage.set('settings', { ...getSettings(), timeLimitSec })
}

export function advanceClock(ms: number): void {
  storage.set('settings', { ...getSettings(), clockOffset: getSettings().clockOffset + ms })
}

export function resetClock(): void {
  storage.set('settings', { ...getSettings(), clockOffset: 0 })
}

// The app's notion of "now" — real time plus any demo clock jump.
export function now(): number {
  return Date.now() + getSettings().clockOffset
}

// Wipe all Clarity data (dev reset for the demo).
export function clearAll(): void {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key)
  }
  keys.forEach((key) => localStorage.removeItem(key))
  notifyStorageChange('*')
}

export type CloudState = {
  progression: ProgressionState | null
  attempts: Attempt[]
  reviews: Record<string, ReviewItem>
  examRecords?: PracticeExamRecord[]
  wordBank?: Record<string, WordBankEntry>
  deckCards?: Record<string, DeckCard>
  deckReviews?: DeckReview[]
}

// Cloud restoration is intentionally atomic from the sync listener's point of
// view, so downloading a snapshot cannot immediately echo partial state back.
export function replaceCloudState(state: CloudState): void {
  suppressChangeEvents = true
  try {
    const preservedSettings = localStorage.getItem(namespacedKey('settings'))
    // Lessons read are device-local reading history, not synced progress —
    // restoring a cloud snapshot shouldn't make the student reread them.
    const preservedLessons = localStorage.getItem(namespacedKey(LESSONS_SEEN_KEY))
    // Same reasoning for the daily return: it is a record of this device's
    // sittings, not of earned progress.
    const preservedDaily = localStorage.getItem(namespacedKey(DAILY_KEY))
    const preservedWords = localStorage.getItem(namespacedKey(WORD_BANK_KEY))
    // The learning decks have no cloud table yet, so a snapshot from another
    // device carries no deck state - dropping what is here would throw away
    // real work rather than replace it.
    const preservedDeckCards = localStorage.getItem(namespacedKey(DECK_CARDS_KEY))
    const preservedDeckLog = localStorage.getItem(namespacedKey(DECK_REVLOG_KEY))
    const preservedDictionary = localStorage.getItem(namespacedKey('dictionary-cache'))
    const preservedStudyPaths: { key: string; value: string }[] = []
    const studyPathPrefix = namespacedKey(`${STUDY_PATH_KEY}:`)
    const preservedExamRecords: { key: string; value: string }[] = []
    const examRecordsPrefix = namespacedKey(EXAM_RECORDS_PREFIX)
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(studyPathPrefix)) {
        const value = localStorage.getItem(key)
        if (value) preservedStudyPaths.push({ key, value })
      }
      if (key?.startsWith(examRecordsPrefix)) {
        const val = localStorage.getItem(key)
        if (val) preservedExamRecords.push({ key, value: val })
      }
    }
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
    if (preservedSettings) {
      localStorage.setItem(namespacedKey('settings'), preservedSettings)
    }
    if (preservedLessons) {
      localStorage.setItem(namespacedKey(LESSONS_SEEN_KEY), preservedLessons)
    }
    if (preservedDaily) {
      localStorage.setItem(namespacedKey(DAILY_KEY), preservedDaily)
    }
    const targetWords =
      state.wordBank !== undefined ? JSON.stringify(state.wordBank) : preservedWords
    if (targetWords) {
      localStorage.setItem(namespacedKey(WORD_BANK_KEY), targetWords)
    }
    if (preservedDictionary) {
      localStorage.setItem(namespacedKey('dictionary-cache'), preservedDictionary)
    }
    const targetDeckCards =
      state.deckCards !== undefined ? JSON.stringify(state.deckCards) : preservedDeckCards
    if (targetDeckCards) {
      localStorage.setItem(namespacedKey(DECK_CARDS_KEY), targetDeckCards)
    }
    const targetDeckLog =
      state.deckReviews !== undefined ? JSON.stringify(state.deckReviews) : preservedDeckLog
    if (targetDeckLog) {
      localStorage.setItem(namespacedKey(DECK_REVLOG_KEY), targetDeckLog)
    }
    preservedStudyPaths.forEach(({ key, value }) => {
      localStorage.setItem(key, value)
    })
    if (state.examRecords === undefined) {
      preservedExamRecords.forEach(({ key, value }) => {
        localStorage.setItem(key, value)
      })
    } else {
      storage.set(SEEDED_KEY, true)
      state.examRecords.forEach((record) => {
        localStorage.setItem(
          namespacedKey(`exam-records:${record.finishedAt}:${record.examId}`),
          JSON.stringify(record),
        )
      })
    }
    if (state.progression) {
      localStorage.setItem(namespacedKey(PROGRESSION_KEY), JSON.stringify(state.progression))
    }
    localStorage.setItem(namespacedKey(REVIEWS_KEY), JSON.stringify(state.reviews))
    state.attempts.forEach((attempt) => {
      localStorage.setItem(
        namespacedKey(`attempts:${attempt.timestamp}:${attempt.questionId}`),
        JSON.stringify(attempt),
      )
    })
  } finally {
    suppressChangeEvents = false
  }
  notifyStorageChange('*')
}

export type ClarityDataBackup = {
  version: 1
  exportedAt: number
  progression: ProgressionState | null
  attempts: Attempt[]
  examRecords: PracticeExamRecord[]
  reviews: Record<string, ReviewItem>
  wordBank: Record<string, WordBankEntry>
  deckCards: Record<string, DeckCard>
  deckReviews: DeckReview[]
  lessonsSeen: Record<string, number>
  daily: DailyState
}

export function exportAllData(): ClarityDataBackup {
  return {
    version: 1,
    exportedAt: Date.now(),
    progression: getProgression(),
    attempts: getAttempts(),
    examRecords: getExamRecords(),
    reviews: getReviews(),
    wordBank: getWordBank(),
    deckCards: getDeckCards(),
    deckReviews: getDeckReviews(),
    lessonsSeen: getLessonsSeen(),
    daily: getDailyState(),
  }
}

export function importAllData(data: unknown): void {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup file format.')
  }

  const raw = data as Record<string, unknown>

  // Smart detection: Single PracticeExamRecord
  if (typeof raw.examId === 'string' && typeof raw.finishedAt === 'number' && raw.result) {
    saveExamRecord(raw as unknown as PracticeExamRecord)
    notifyStorageChange('*')
    return
  }

  // Standard ClarityDataBackup
  const progression = (raw.progression as ProgressionState) ?? null
  const attempts = Array.isArray(raw.attempts) ? (raw.attempts as Attempt[]) : []
  const examRecords = Array.isArray(raw.examRecords)
    ? (raw.examRecords as PracticeExamRecord[])
    : undefined
  const reviews =
    typeof raw.reviews === 'object' && raw.reviews !== null
      ? (raw.reviews as Record<string, ReviewItem>)
      : {}
  const wordBank =
    typeof raw.wordBank === 'object' && raw.wordBank !== null
      ? (raw.wordBank as Record<string, WordBankEntry>)
      : {}

  const deckCards =
    typeof raw.deckCards === 'object' && raw.deckCards !== null
      ? (raw.deckCards as Record<string, DeckCard>)
      : undefined
  const deckReviews = Array.isArray(raw.deckReviews)
    ? (raw.deckReviews as DeckReview[])
    : undefined

  replaceCloudState({
    progression,
    attempts,
    reviews,
    examRecords,
    wordBank,
    deckCards,
    deckReviews,
  })

  if (raw.lessonsSeen && typeof raw.lessonsSeen === 'object') {
    localStorage.setItem(
      namespacedKey(LESSONS_SEEN_KEY),
      JSON.stringify(raw.lessonsSeen),
    )
  }
  if (raw.daily && typeof raw.daily === 'object') {
    saveDailyState(normalizeDailyState(raw.daily as Partial<DailyState>))
  }
  notifyStorageChange('*')
}

export function subscribeStorageChanges(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (event: Event) => {
    const key = (event as CustomEvent<{ key?: string }>).detail?.key
    if (
      key === '*' ||
      key === PROGRESSION_KEY ||
      key === REVIEWS_KEY ||
      key === WORD_BANK_KEY ||
      key === DECK_CARDS_KEY ||
      key === DECK_REVLOG_KEY ||
      key?.startsWith('attempts:') ||
      key?.startsWith('exam-records:') ||
      key?.startsWith('exam-draft:')
    ) {
      listener()
    }
  }
  window.addEventListener(STORAGE_CHANGE_EVENT, handler)
  return () => window.removeEventListener(STORAGE_CHANGE_EVENT, handler)
}
