// Water drops for money: 10 drops to the dollar, sold in four packs.
//
// The rules the shop keeps, from the research in docs/redesign/RESEARCH.md §7:
//   - every drop price is also shown in dollars (EU CPC principles, 2025)
//   - drops buy fixed items only; sticker packs, XP, stars and anything that
//     moves learning are never for sale, so nothing random is sold for money
//     (the FTC's 2025 Genshin order targeted exactly that for under-16s)
//   - a parent or guardian pays for anyone under 18, and every account has a
//     monthly limit
//   - the smallest pack is $1.99, not $0.99: card fees take ~30¢ a sale, a
//     third of a dollar
//
// Two modes. With Stripe Payment Links configured (one VITE_DROPS_LINK_* per
// pack) and Supabase on, checkout goes to Stripe and the drops-webhook edge
// function records the purchase; the app picks it up from drop_purchases.
// Otherwise the shop runs a preview checkout that never charges anything and
// marks every receipt TEST.

import { isSupabaseConfigured, supabase } from '../../lib/supabase.ts'
import type { GameState, Purchase } from './engine.ts'

export const DROPS_PER_DOLLAR = 10
export const MONTHLY_LIMIT_CENTS = 5000

export type PackId = 'splash' | 'cup' | 'bottle' | 'jug'
export type Pack = { id: PackId; name: string; drops: number; cents: number }

export const PACKS: Pack[] = [
  { id: 'splash', name: 'Splash', drops: 20, cents: 199 },
  { id: 'cup', name: 'Cup', drops: 55, cents: 499 },
  { id: 'bottle', name: 'Bottle', drops: 120, cents: 999 },
  { id: 'jug', name: 'Jug', drops: 260, cents: 1999 },
]

/** Extra drops over the 10-for-$1 base rate, as a whole percentage. */
export function bonusPercent(pack: Pack): number {
  const base = (pack.cents / 100) * DROPS_PER_DOLLAR
  return Math.max(0, Math.floor((pack.drops / base - 1) * 100))
}

export function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/** What a number of drops is worth at the base rate: 15 drops → "$1.50". */
export function dropsInDollars(drops: number): string {
  return dollars(Math.round((drops / DROPS_PER_DOLLAR) * 100))
}

export function spentThisMonth(purchases: Purchase[] = [], now = new Date()): number {
  return purchases
    .filter((purchase) => {
      const at = new Date(purchase.at)
      return purchase.status === 'paid' && at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth()
    })
    .reduce((sum, purchase) => sum + purchase.cents, 0)
}

export function canAfford(pack: Pack, purchases: Purchase[] = [], now = new Date()): boolean {
  return spentThisMonth(purchases, now) + pack.cents <= MONTHLY_LIMIT_CENTS
}

// ---------------------------------------------------------------------------
// Which checkout runs

type Env = Record<string, string | undefined>
const env: Env = (import.meta as ImportMeta & { env?: Env }).env ?? {}

function paymentLink(id: PackId): string | undefined {
  return env[`VITE_DROPS_LINK_${id.toUpperCase()}`]?.trim() || undefined
}

export type PaymentsMode = 'stripe' | 'preview'

export function paymentsMode(): PaymentsMode {
  return isSupabaseConfigured && PACKS.every((pack) => paymentLink(pack.id)) ? 'stripe' : 'preview'
}

/** Stripe Payment Link for a pack, tagged with the account so the webhook can credit it. */
export function checkoutUrl(pack: Pack, userId: string, email?: string): string {
  const url = new URL(paymentLink(pack.id)!)
  url.searchParams.set('client_reference_id', userId)
  if (email) url.searchParams.set('prefilled_email', email)
  return url.toString()
}

// ---------------------------------------------------------------------------
// Crediting drops

/** The preview checkout: drops land, nothing is charged, the receipt says TEST. */
export function recordTestPurchase(state: GameState, pack: Pack, now = Date.now()): GameState {
  const purchase: Purchase = { id: `test-${now}`, packId: pack.id, drops: pack.drops, cents: pack.cents, at: now, mode: 'test', status: 'paid' }
  return { ...state, ink: state.ink + pack.drops, purchases: [...(state.purchases ?? []), purchase] }
}

/**
 * Merge the server's purchase records into the game: a paid purchase not seen
 * before adds its drops once; a refund takes them back (never below zero).
 */
export function applyPurchases(state: GameState, rows: Purchase[]): GameState {
  let next = state
  for (const row of rows) {
    const known = (next.purchases ?? []).find((purchase) => purchase.id === row.id)
    if (!known && row.status === 'paid') {
      next = { ...next, ink: next.ink + row.drops, purchases: [...(next.purchases ?? []), row] }
    } else if (known && known.status === 'paid' && row.status === 'refunded') {
      next = {
        ...next,
        ink: Math.max(0, next.ink - known.drops),
        purchases: (next.purchases ?? []).map((purchase) => (purchase.id === row.id ? { ...purchase, status: 'refunded' } : purchase)),
      }
    }
  }
  return next
}

/** The signed-in student's purchases, as the webhook recorded them. */
export async function fetchLivePurchases(): Promise<Purchase[]> {
  if (!isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase.from('drop_purchases').select('id, pack_id, drops, amount_total, status, created_at').order('created_at')
  if (error || !data) return []
  return (data as Array<{ id: string; pack_id: string; drops: number; amount_total: number; status: string; created_at: string }>).map((row) => ({
    id: row.id,
    packId: row.pack_id,
    drops: row.drops,
    cents: row.amount_total,
    at: Date.parse(row.created_at),
    mode: 'live' as const,
    status: row.status === 'refunded' ? ('refunded' as const) : ('paid' as const),
  }))
}
