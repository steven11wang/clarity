import type { Attempt, ReviewItem } from '../types.ts'

const STORAGE_PREFIX = 'clarity:v1:'

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

export const storage = {
  get<T>(key: string): T | null {
    return parseValue<T>(localStorage.getItem(namespacedKey(key)))
  },

  set<T>(key: string, value: T): void {
    localStorage.setItem(namespacedKey(key), JSON.stringify(value))
  },

  remove(key: string): void {
    localStorage.removeItem(namespacedKey(key))
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

// --- Dev settings -----------------------------------------------------------
// demoMode compresses review intervals to seconds; clockOffset lets the demo
// jump forward in time so scheduled items come due without waiting.

type Settings = { demoMode: boolean; clockOffset: number }

const DEFAULT_SETTINGS: Settings = { demoMode: false, clockOffset: 0 }

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...(storage.get<Partial<Settings>>('settings') ?? {}) }
}

export function setDemoMode(demoMode: boolean): void {
  storage.set('settings', { ...getSettings(), demoMode })
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
}
