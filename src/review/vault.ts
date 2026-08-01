import type { Question, ReviewItem } from '../types.ts'
import { isDue, isRetired } from './schedule.ts'

// The mistake vault is the persistent view of the resurrection queue: every
// question a student got wrong, when it comes back, and how many clean returns
// it has survived. Unlike the practice stream (which hides review items among
// fresh ones), the vault is deliberately explicit — it exists so the student can
// see and re-drill their own misses on purpose.

export type VaultStatus = 'due' | 'scheduled' | 'retired'

export type VaultEntry = {
  question: Question
  item: ReviewItem
  status: VaultStatus
  // Milliseconds until the next return; <= 0 when due, 0 for retired items.
  dueInMs: number
}

export function vaultStatus(item: ReviewItem, now: number): VaultStatus {
  if (isRetired(item)) return 'retired'
  return isDue(item, now) ? 'due' : 'scheduled'
}

const STATUS_ORDER: Record<VaultStatus, number> = { due: 0, scheduled: 1, retired: 2 }

// Build the vault from the review store, dropping entries whose question is no
// longer in the loaded bank. Due items come first (oldest debt first), then
// upcoming returns by how soon they land, then retired ones most-recent first.
export function buildVault(
  questions: Question[],
  reviews: Record<string, ReviewItem>,
  now: number,
): VaultEntry[] {
  const byId = new Map(questions.map((question) => [question.id, question]))
  const entries: VaultEntry[] = []

  for (const item of Object.values(reviews)) {
    const question = byId.get(item.questionId)
    if (!question) continue
    const status = vaultStatus(item, now)
    entries.push({
      question,
      item,
      status,
      dueInMs: status === 'retired' ? 0 : item.dueAt - now,
    })
  }

  return entries.sort((a, b) => {
    const order = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (order !== 0) return order
    if (a.status === 'retired') {
      return (b.item.lastReviewedAt ?? 0) - (a.item.lastReviewedAt ?? 0)
    }
    return a.item.dueAt - b.item.dueAt
  })
}

export function vaultCounts(entries: VaultEntry[]): Record<VaultStatus, number> {
  return entries.reduce(
    (counts, entry) => ({ ...counts, [entry.status]: counts[entry.status] + 1 }),
    { due: 0, scheduled: 0, retired: 0 } as Record<VaultStatus, number>,
  )
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// "Ready now" / "in 4 hours" / "in 3 days" — coarse on purpose; the exact
// millisecond a card unlocks is never the interesting part.
export function formatDueIn(ms: number): string {
  if (ms <= 0) return 'Ready now'
  if (ms < HOUR) return `in ${Math.max(1, Math.round(ms / MINUTE))} min`
  if (ms < DAY) {
    const hours = Math.round(ms / HOUR)
    return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }
  const days = Math.round(ms / DAY)
  return `in ${days} ${days === 1 ? 'day' : 'days'}`
}

export const REASON_LABELS: Record<ReviewItem['reason'], string> = {
  miss: 'Missed it',
  'hidden-error': 'Right for the wrong reason',
  timeout: 'Ran out of time',
}
