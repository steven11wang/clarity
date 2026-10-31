import assert from 'node:assert/strict'
import test from 'node:test'

import { OUTFITS } from './content.ts'
import { freshState, type Purchase } from './engine.ts'
import { MONTHLY_LIMIT_CENTS, PACKS, applyPurchases, bonusPercent, canAfford, dropsInDollars, recordTestPurchase, spentThisMonth } from './payments.ts'

const DAY = '2026-10-30'

test('10 drops is a dollar, and bigger packs carry a bigger bonus', () => {
  assert.equal(dropsInDollars(10), '$1.00')
  assert.equal(dropsInDollars(15), '$1.50')
  const bonuses = PACKS.map(bonusPercent)
  assert.deepEqual(bonuses, [0, 10, 20, 30])
  // no pack is cheaper than the base rate gives
  for (const pack of PACKS) assert.ok(pack.drops >= Math.floor((pack.cents / 100) * 10))
})

test('drawn outfits stay under $6; gem portraits under $12, about two weeks of free drops', () => {
  for (const outfit of OUTFITS) assert.ok(outfit.price <= (outfit.art ? 120 : 60), `${outfit.name} is ${outfit.price} drops`)
})

test('a preview purchase adds drops and leaves a TEST receipt', () => {
  const state = recordTestPurchase(freshState(DAY), PACKS[1], Date.parse('2026-10-30T12:00:00Z'))
  assert.equal(state.ink, 5 + 55)
  assert.equal(state.purchases?.[0].mode, 'test')
})

test('server purchases credit once, and a refund takes the drops back', () => {
  const paid: Purchase = { id: 'p1', packId: 'cup', drops: 55, cents: 499, at: Date.now(), mode: 'live', status: 'paid' }
  let state = applyPurchases(freshState(DAY), [paid])
  state = applyPurchases(state, [paid])
  assert.equal(state.ink, 60)
  state = applyPurchases(state, [{ ...paid, status: 'refunded' }])
  assert.equal(state.ink, 5)
  assert.equal(state.purchases?.[0].status, 'refunded')
})

test('the monthly limit counts this month’s paid purchases only', () => {
  const now = new Date('2026-10-30T12:00:00Z')
  const purchases: Purchase[] = [
    { id: 'a', packId: 'jug', drops: 260, cents: 1999, at: Date.parse('2026-10-02T12:00:00Z'), mode: 'test', status: 'paid' },
    { id: 'b', packId: 'jug', drops: 260, cents: 1999, at: Date.parse('2026-10-20T12:00:00Z'), mode: 'test', status: 'paid' },
    { id: 'c', packId: 'jug', drops: 260, cents: 1999, at: Date.parse('2026-09-20T12:00:00Z'), mode: 'test', status: 'paid' },
    { id: 'd', packId: 'jug', drops: 260, cents: 1999, at: Date.parse('2026-10-21T12:00:00Z'), mode: 'test', status: 'refunded' },
  ]
  assert.equal(spentThisMonth(purchases, now), 3998)
  assert.equal(canAfford(PACKS[3], purchases, now), false) // 39.98 + 19.99 > 50
  assert.equal(canAfford(PACKS[2], purchases, now), true) // 39.98 + 9.99 <= 50
  assert.ok(MONTHLY_LIMIT_CENTS === 5000)
})
