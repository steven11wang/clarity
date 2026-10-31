import assert from 'node:assert/strict'
import test from 'node:test'

import { COMEBACK_DAYS, DOMAINS, PATH, REWARDS } from './content.ts'
import {
  PITY,
  addDays,
  isUnlocked,
  drawSticker,
  dueComebacks,
  fileMiss,
  freshState,
  levelInfo,
  markStudied,
  questsFor,
  rankFor,
  rollover,
  settleComeback,
  weekKey,
} from './engine.ts'

const DAY = '2026-10-30'

test('a miss comes back after 1, 3, 7 and 21 days, then clears', () => {
  let state = fileMiss(freshState(DAY), 'q1', 'Transitions', DAY)
  let day = DAY
  assert.equal(dueComebacks(state, day).length, 0)
  for (const gap of COMEBACK_DAYS) {
    day = addDays(day, gap)
    assert.equal(dueComebacks(state, day).length, 1, `due after ${gap} days`)
    state = settleComeback(state, 'q1', true, day)
  }
  assert.equal(state.misses.q1.cleared, true)
  assert.equal(state.misses.q1.beats, COMEBACK_DAYS.length)
  assert.equal(dueComebacks(state, addDays(day, 60)).length, 0)
})

test('missing a comeback sends it back to tomorrow', () => {
  let state = fileMiss(freshState(DAY), 'q1', 'Transitions', DAY)
  state = settleComeback(state, 'q1', true, addDays(DAY, 1))
  state = settleComeback(state, 'q1', false, addDays(DAY, 4))
  assert.equal(state.misses.q1.stage, 0)
  assert.equal(state.misses.q1.dueDay, addDays(DAY, 5))
})

test('a comeback pays more than a first-try answer', () => {
  assert.ok(REWARDS.comebackXp > REWARDS.firstTryXp)
  assert.ok(REWARDS.comebackInk > REWARDS.firstTryInk)
})

test('streak grows day to day and correction tape covers one missed day', () => {
  let state = markStudied(freshState(DAY), DAY)
  state = markStudied(state, addDays(DAY, 1))
  assert.equal(state.streak.count, 2)
  // skip a day: the one roll of tape a new player starts with covers it
  state = rollover(state, addDays(DAY, 3))
  assert.equal(state.streak.count, 2)
  assert.equal(state.streak.tapes, 0)
  state = markStudied(state, addDays(DAY, 3))
  assert.equal(state.streak.count, 3)
  // skip again with no tape left: the streak resets
  state = rollover(state, addDays(DAY, 6))
  assert.equal(state.streak.count, 0)
})

test('the weekly card starts with one stamp already on it', () => {
  assert.equal(freshState(DAY).weekly.stamps, 1)
})

test('the tenth pack without holo foil is holo', () => {
  let state = { ...freshState(DAY), packs: 20, pity: PITY - 1 }
  const always = () => 0.99 // a roll that would otherwise always land on plain
  const result = drawSticker(state, always)
  assert.equal(result.sticker.rarity, 'holo')
  assert.equal(result.state.pity, 0)
  state = result.state
  assert.equal(drawSticker(state, always).sticker.rarity, 'plain')
})

test('levels need more XP as they go', () => {
  assert.equal(levelInfo(0).level, 1)
  assert.equal(levelInfo(119).level, 1)
  assert.equal(levelInfo(120).level, 2)
  assert.equal(levelInfo(120 + 170).level, 3)
})

test('quests are stable for a day and always include turning in a page', () => {
  assert.deepEqual(questsFor(DAY), questsFor(DAY))
  assert.equal(questsFor(DAY)[0].kind, 'turn-in-page')
  assert.equal(new Set(questsFor(DAY).map((quest) => quest.kind)).size, 3)
})

test('weeks start on Monday', () => {
  assert.equal(weekKey('2026-10-30'), '2026-10-26')
  assert.equal(weekKey('2026-10-26'), '2026-10-26')
})

test('ranks climb from Pencil to the 800 Club', () => {
  assert.equal(rankFor(0).rank.name, 'Pencil')
  assert.equal(rankFor(260).rank.name, 'Gel Pen')
  assert.equal(rankFor(900).next, null)
})

test('every section opens on its first stop; later stops wait for the one before', () => {
  let state = freshState(DAY)
  for (const domain of DOMAINS) {
    const section = PATH.filter((node) => node.domainId === domain.id)
    assert.equal(isUnlocked(state, section[0].id), true, `${domain.name} starts open`)
    assert.equal(isUnlocked(state, section[1].id), false, `${domain.name} stop 2 starts locked`)
  }
  const conventions = PATH.filter((node) => node.domainId === 'conventions')
  state = { ...state, completed: [conventions[0].id] }
  assert.equal(isUnlocked(state, conventions[1].id), true)
})
