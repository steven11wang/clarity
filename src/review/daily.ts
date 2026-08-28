import { wordStatus, type WordBankEntry } from '../dictionary/wordBank.ts'
import type { Question, ReviewItem } from '../types.ts'
import { resolveReviewQuestion } from './resolve.ts'
import { isDue, isRetired } from './schedule.ts'

// The daily return: the first time a student opens Clarity on a new day, the
// misses and words that came due overnight are handed back in one guided run —
// questions first, then the words saved alongside them. The ladder itself lives
// in schedule.ts; this module only decides what today owes and whether the
// briefing has already been shown.

const HOUR = 60 * 60 * 1000

// A study day rolls over at 4am local rather than midnight. A session that runs
// past midnight belongs to the day it started, so the briefing never interrupts
// someone who is still working.
export const DAY_START_HOUR = 4

function formatKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function dayKey(at: number): string {
  return formatKey(new Date(at - DAY_START_HOUR * HOUR))
}

export function previousDayKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() - 1)
  return formatKey(date)
}

// Each due item is labelled by how long it has been away, not by its internal
// stage number: "Yesterday" is the thing the student actually recognizes.
export const COHORT_LABELS = ['Yesterday', 'Three days back', 'A week back', 'A month back']

export function cohortLabel(stage: number, demo: boolean): string {
  if (demo) return `Round ${stage + 1}`
  return COHORT_LABELS[stage] ?? 'Earlier'
}

export type DailyCohort = {
  stage: number
  label: string
  questions: number
  words: number
}

// What is on the ladder but not owed yet. The Reflect tab reports this so a
// student who has just filed three misses sees them waiting rather than an
// empty screen — nothing is due the same day it was missed.
export type DailyUpcoming = {
  questions: number
  words: number
  nextDueAt: number | null
}

export type DailyPlan = {
  day: string
  questions: Question[]
  words: WordBankEntry[]
  cohorts: DailyCohort[]
  total: number
  upcoming: DailyUpcoming
}

export const EMPTY_PLAN: DailyPlan = {
  day: '',
  questions: [],
  words: [],
  cohorts: [],
  total: 0,
  upcoming: { questions: 0, words: 0, nextDueAt: null },
}

// Everything due right now, oldest debt first, grouped by how long it was away,
// plus a count of what is filed and still waiting. Questions that can be
// produced neither from the bank nor from their own filed copy are dropped, the
// same way the vault drops them — a plan must never promise a question it
// cannot show.
export function buildDailyPlan(
  questions: Question[],
  reviews: Record<string, ReviewItem>,
  words: WordBankEntry[],
  at: number,
  demo: boolean,
): DailyPlan {
  const byId = new Map(questions.map((question) => [question.id, question]))

  const openItems = Object.values(reviews)
    .map((item) => ({ item, question: resolveReviewQuestion(byId, item) }))
    .filter((entry): entry is { item: ReviewItem; question: Question } =>
      entry.question !== null && !isRetired(entry.item),
    )

  const dueItems = openItems
    .filter((entry) => isDue(entry.item, at))
    .map((entry) => entry.item)
    .sort((a, b) => a.dueAt - b.dueAt)

  const waitingItems = openItems.filter((entry) => !isDue(entry.item, at))

  const dueWords = words
    .filter((entry) => wordStatus(entry, at) === 'due')
    .sort((a, b) => a.dueAt - b.dueAt)

  const waitingWords = words.filter((entry) => wordStatus(entry, at) === 'scheduled')

  const nextDueAt = [
    ...waitingItems.map((entry) => entry.item.dueAt),
    ...waitingWords.map((entry) => entry.dueAt),
  ].reduce<number | null>(
    (soonest, dueAt) => (soonest === null || dueAt < soonest ? dueAt : soonest),
    null,
  )

  const cohorts = new Map<number, DailyCohort>()
  function bump(stage: number, kind: 'questions' | 'words') {
    const cohort = cohorts.get(stage) ?? { stage, label: cohortLabel(stage, demo), questions: 0, words: 0 }
    cohort[kind] += 1
    cohorts.set(stage, cohort)
  }
  dueItems.forEach((item) => bump(item.stage, 'questions'))
  dueWords.forEach((entry) => bump(entry.stage, 'words'))

  return {
    day: dayKey(at),
    questions: dueItems.map((item) => resolveReviewQuestion(byId, item)!),
    words: dueWords,
    cohorts: [...cohorts.values()].sort((a, b) => a.stage - b.stage),
    total: dueItems.length + dueWords.length,
    upcoming: {
      questions: waitingItems.length,
      words: waitingWords.length,
      nextDueAt,
    },
  }
}

// --- Per-day bookkeeping -----------------------------------------------------

export type DailyState = {
  schemaVersion: 1
  // The day the briefing was last shown — shown once per day, dismissed or not,
  // so a student who says "not now" isn't nagged on every navigation.
  lastPromptedDay: string | null
  lastCompletedDay: string | null
  streak: number
}

export const EMPTY_DAILY_STATE: DailyState = {
  schemaVersion: 1,
  lastPromptedDay: null,
  lastCompletedDay: null,
  streak: 0,
}

export function normalizeDailyState(raw: Partial<DailyState> | null): DailyState {
  if (!raw) return EMPTY_DAILY_STATE
  return {
    schemaVersion: 1,
    lastPromptedDay: typeof raw.lastPromptedDay === 'string' ? raw.lastPromptedDay : null,
    lastCompletedDay: typeof raw.lastCompletedDay === 'string' ? raw.lastCompletedDay : null,
    streak: typeof raw.streak === 'number' && raw.streak >= 0 ? raw.streak : 0,
  }
}

export function shouldPrompt(state: DailyState, plan: DailyPlan): boolean {
  return plan.total > 0 && state.lastPromptedDay !== plan.day
}

export function markPrompted(state: DailyState, day: string): DailyState {
  return state.lastPromptedDay === day ? state : { ...state, lastPromptedDay: day }
}

// A streak counts days finished, not days opened. Finishing yesterday's return
// and then today's extends it; a skipped day restarts the count at one.
export function completeDay(state: DailyState, day: string): DailyState {
  if (state.lastCompletedDay === day) return state
  const continued = state.lastCompletedDay === previousDayKey(day)
  return {
    ...state,
    lastPromptedDay: day,
    lastCompletedDay: day,
    streak: continued ? state.streak + 1 : 1,
  }
}

// The streak a student is actually carrying today: it survives while today's
// return is still open, and is gone once a whole day has passed unfinished.
export function liveStreak(state: DailyState, today: string): number {
  if (state.lastCompletedDay === today) return state.streak
  if (state.lastCompletedDay === previousDayKey(today)) return state.streak
  return 0
}
