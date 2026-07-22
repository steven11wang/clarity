import type { Attempt } from '../types.ts'

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

export function recordAttempt(attempt: Attempt): void {
  storage.set(`attempts:${attempt.timestamp}:${attempt.questionId}`, attempt)
}
