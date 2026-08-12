import { RETIRED_STAGE, intervalsFor, STAGE_LABELS } from '../review/schedule.ts'

// A word the learner met in a passage, looked up, and chose to keep. It rides
// the same widening ladder as the mistake vault - 1 day, 3 days, a week, a
// month - because the point is the same: bring it back until it can't catch
// you. The sentence it was met in is stored with it, since a word learned in
// context is the only kind that survives to test day.

export type WordBankEntry = {
  /** Normalized word; one card per word. */
  id: string
  /** The word as it read in the passage. */
  word: string
  partOfSpeech: string
  definition: string
  /** The passage sentence the word was met in. */
  sentence: string
  source: { examId: string; questionId: string } | null
  savedAt: number
  stage: number
  dueAt: number
  clears: number
  lapses: number
  lastReviewedAt: number | null
}

export type WordStatus = 'due' | 'scheduled' | 'retired'

export type NewWord = {
  id: string
  word: string
  partOfSpeech: string
  definition: string
  sentence: string
  source?: { examId: string; questionId: string } | null
}

export function createWordEntry(input: NewWord, demo: boolean, now: number): WordBankEntry {
  return {
    id: input.id,
    word: input.word,
    partOfSpeech: input.partOfSpeech,
    definition: input.definition,
    sentence: input.sentence,
    source: input.source ?? null,
    savedAt: now,
    stage: 0,
    dueAt: now + intervalsFor(demo)[0],
    clears: 0,
    lapses: 0,
    lastReviewedAt: null,
  }
}

/**
 * A flashcard answer. "Knew it" advances a rung and retires the card after the
 * last one; "didn't know it" drops it back to the start, the same way a
 * repeated miss restarts a vault question.
 */
export function applyRecall(
  entry: WordBankEntry,
  knewIt: boolean,
  demo: boolean,
  now: number,
): WordBankEntry {
  const intervals = intervalsFor(demo)
  if (!knewIt) {
    return {
      ...entry,
      stage: 0,
      clears: 0,
      lapses: entry.lapses + 1,
      dueAt: now + intervals[0],
      lastReviewedAt: now,
    }
  }
  const nextStage = entry.stage === RETIRED_STAGE ? RETIRED_STAGE : entry.stage + 1
  const clears = entry.clears + 1
  if (nextStage === RETIRED_STAGE || nextStage >= intervals.length) {
    return { ...entry, stage: RETIRED_STAGE, clears, dueAt: now, lastReviewedAt: now }
  }
  return {
    ...entry,
    stage: nextStage,
    clears,
    dueAt: now + intervals[nextStage],
    lastReviewedAt: now,
  }
}

export function wordStatus(entry: WordBankEntry, now: number): WordStatus {
  if (entry.stage === RETIRED_STAGE) return 'retired'
  return entry.dueAt <= now ? 'due' : 'scheduled'
}

const STATUS_ORDER: Record<WordStatus, number> = { due: 0, scheduled: 1, retired: 2 }

/** Due first (oldest debt first), then upcoming returns, then retired words. */
export function sortWords(entries: WordBankEntry[], now: number): WordBankEntry[] {
  return [...entries].sort((a, b) => {
    const order = STATUS_ORDER[wordStatus(a, now)] - STATUS_ORDER[wordStatus(b, now)]
    if (order !== 0) return order
    if (wordStatus(a, now) === 'retired') return b.savedAt - a.savedAt
    return a.dueAt - b.dueAt
  })
}

export function dueWords(entries: WordBankEntry[], now: number): WordBankEntry[] {
  return sortWords(entries.filter((entry) => wordStatus(entry, now) === 'due'), now)
}

export function wordCounts(entries: WordBankEntry[], now: number): Record<WordStatus, number> {
  return entries.reduce(
    (counts, entry) => {
      counts[wordStatus(entry, now)] += 1
      return counts
    },
    { due: 0, scheduled: 0, retired: 0 } as Record<WordStatus, number>,
  )
}

export function wordStageLabel(entry: WordBankEntry): string {
  return entry.stage === RETIRED_STAGE ? 'Retired' : STAGE_LABELS[entry.stage] ?? 'Retired'
}

/**
 * The sentence with the saved word blanked out - the cloze prompt a flashcard
 * shows before the definition, so recall is tested in context.
 */
export function clozeSentence(entry: WordBankEntry): string {
  const pattern = new RegExp(`\\b${escapeRegExp(entry.word)}\\w*\\b`, 'i')
  if (!pattern.test(entry.sentence)) return entry.sentence
  return entry.sentence.replace(pattern, '______')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
