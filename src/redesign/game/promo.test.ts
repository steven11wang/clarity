import assert from 'node:assert/strict'
import test from 'node:test'

import { FOUNDER } from './content.ts'
import { addDays, founderDays, freshState, grantFounder, markStudied } from './engine.ts'
import { isFounderCode, normaliseCode, sha256 } from './promo.ts'

const DAY = '2026-11-02'

test('the founder code is read the way people type it', async () => {
  // the real code isn't in the repo; a stand-in hash checks the matching
  const known = [await sha256('SAMPLECODE42')]
  assert.equal(normaliseCode(' sample-code 42 '), 'SAMPLECODE42')
  assert.equal(await isFounderCode('sample code-42', known), true)
  assert.equal(await isFounderCode('SAMPLECODE43', known), false)
  assert.equal(await isFounderCode('', known), false)
})

test('entering the code gives the Summer Scholar, the title and the welcome drops, once', () => {
  const start = freshState(DAY)
  const once = grantFounder(start, DAY)
  assert.ok(once.founder)
  assert.equal(once.outfit, FOUNDER.outfit)
  assert.ok(once.owned.includes(FOUNDER.outfit))
  assert.equal(once.ink, start.ink + FOUNDER.welcomeDrops)
  assert.equal(grantFounder(once, addDays(DAY, 3)), once)
})

test('the rest of the drops arrive on the tenth study day, not the tenth streak day', () => {
  let state = grantFounder(freshState(DAY), DAY)
  const afterCode = state.ink
  // ten study days across two weeks, with gaps
  for (let i = 0; i < 14; i += 1) {
    if (i % 3 === 2) continue
    state = markStudied(state, addDays(DAY, i))
    if (founderDays(state) < FOUNDER.goalDays) assert.equal(state.ink, afterCode)
  }
  assert.equal(founderDays(state) >= FOUNDER.goalDays, true)
  assert.equal(state.ink, afterCode + FOUNDER.goalDrops)
  assert.equal(state.founder?.goalPaid, true)
  // and only once
  state = markStudied(state, addDays(DAY, 20))
  assert.equal(state.ink, afterCode + FOUNDER.goalDrops)
})

test('study days before the code do not count toward it', () => {
  let state = freshState(DAY)
  for (let i = 0; i < 12; i += 1) state = markStudied(state, addDays(DAY, i))
  state = grantFounder(state, addDays(DAY, 11))
  assert.equal(founderDays(state), 1)
  assert.equal(state.founder?.goalPaid, false)
})
