import type { Attempt, ReviewItem } from '../types.ts'
import type { ProgressionState } from '../progression/model.ts'
import type { Level, SatDomain } from '../progression/config.ts'
import type { SkillQuizPurpose } from '../progression/model.ts'

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
    window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT, { detail: { key } }))
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
}

export function subscribeStorageChanges(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (event: Event) => {
    const key = (event as CustomEvent<{ key?: string }>).detail?.key
    if (
      key === '*' ||
      key === PROGRESSION_KEY ||
      key === REVIEWS_KEY ||
      key?.startsWith('attempts:')
    ) {
      listener()
    }
  }
  window.addEventListener(STORAGE_CHANGE_EVENT, handler)
  return () => window.removeEventListener(STORAGE_CHANGE_EVENT, handler)
}
