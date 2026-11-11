import assert from 'node:assert/strict'
import test from 'node:test'

import { ALL_SKILLS, ALL_TRAPS, COMEBACK_DAYS, DOMAINS, PATH, REWARDS, TRAPS, trapsFor } from './content.ts'
import {
  PITY,
  ESTIMATE_MIN_ANSWERS,
  addDays,
  currentNode,
  fileLucky,
  isPassed,
  isUnlocked,
  practiceEstimate,
  recordAnswer,
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

test('every section opens on its first skill, lesson and all three pages at once', () => {
  const state = freshState(DAY)
  for (const domain of DOMAINS) {
    const section = PATH.filter((node) => node.domainId === domain.id)
    const firstSkill = section.filter((node) => node.skill === domain.skills[0])
    assert.equal(firstSkill.length, 4, 'a lesson and three pages')
    for (const node of firstSkill) assert.equal(isUnlocked(state, node.id), true, `${node.title} starts open`)
    const later = section.find((node) => node.skill !== domain.skills[0])
    assert.equal(isUnlocked(state, later!.id), false, `${later!.title} starts locked`)
  }
})

test('turning in a skill’s Hard page tests out of it and opens the next skill', () => {
  let state = freshState(DAY)
  const craft = PATH.filter((node) => node.domainId === 'craft')
  const [lesson, easy, medium, hard, nextLesson] = craft
  assert.equal(currentNode(state).id, lesson.id)
  state = { ...state, completed: [hard.id] }
  for (const node of [lesson, easy, medium]) {
    assert.equal(isPassed(state, node.id), true, `${node.title} is skipped over`)
    assert.equal(isUnlocked(state, node.id), true, `${node.title} stays open to go back to`)
  }
  assert.equal(isUnlocked(state, nextLesson.id), true)
  assert.equal(currentNode(state).id, nextLesson.id)
  // the chapter test still waits for every skill in the chapter
  const boss = craft.find((node) => node.kind === 'boss')!
  assert.equal(isUnlocked(state, boss.id), false)
})

test('a lucky guess is clipped one rung up and fails back to a full miss', () => {
  let state = fileLucky(freshState(DAY), 'q1', 'Inferences', DAY)
  assert.equal(state.misses.q1.kind, 'lucky')
  assert.equal(state.misses.q1.dueDay, addDays(DAY, COMEBACK_DAYS[1]), 'skips the next-day check')
  assert.equal(dueComebacks(state, addDays(DAY, 1)).length, 0)
  // beaten on each return, it clears in three checks instead of four
  let day = state.misses.q1.dueDay
  let checks = 0
  while (!state.misses.q1.cleared) {
    state = settleComeback(state, 'q1', true, day)
    day = state.misses.q1.dueDay
    checks += 1
  }
  assert.equal(checks, COMEBACK_DAYS.length - 1)

  // missed on its first check, it was never known: the whole ladder, from tomorrow
  let failed = fileLucky(freshState(DAY), 'q2', 'Inferences', DAY)
  const due = failed.misses.q2.dueDay
  failed = settleComeback(failed, 'q2', false, due)
  assert.equal(failed.misses.q2.kind, 'miss')
  assert.equal(failed.misses.q2.beats, 0)
  assert.equal(failed.misses.q2.dueDay, addDays(due, COMEBACK_DAYS[0]))
})

test('a lucky guess never overwrites a miss already on file', () => {
  const missed = fileMiss(freshState(DAY), 'q1', 'Inferences', DAY)
  assert.deepEqual(fileLucky(missed, 'q1', 'Inferences', addDays(DAY, 1)), missed)
})

test('sure-and-wrong comes back ahead of other misses due the same day', () => {
  let state = fileMiss(freshState(DAY), 'guessed', 'Inferences', DAY)
  state = fileMiss(state, 'certain', 'Inferences', DAY, true)
  assert.deepEqual(dueComebacks(state, addDays(DAY, 1)).map((entry) => entry.qid), ['certain', 'guessed'])
  // an older miss still outranks a newer one, sure or not
  state = fileMiss(state, 'newer', 'Inferences', addDays(DAY, 1), true)
  assert.equal(dueComebacks(state, addDays(DAY, 2))[0].qid, 'certain')
})

test('every skill names traps that fit it, each with a way to beat it', () => {
  for (const skill of ALL_SKILLS) {
    const traps = trapsFor(skill)
    assert.ok(traps.length >= 3 && traps.length <= 5, `${skill} has ${traps.length} traps`)
    assert.equal(new Set(traps.map((trap) => trap.id)).size, traps.length)
  }
  assert.deepEqual(trapsFor('Inferences'), TRAPS)
  assert.ok(!trapsFor('Boundaries').some((trap) => trap.id === 'too-extreme'), 'grammar gets grammar traps')
  for (const trap of ALL_TRAPS) assert.ok(trap.fix.length > 10 && trap.tell.length > 10, trap.id)
  assert.equal(new Set(ALL_TRAPS.map((trap) => trap.id)).size, ALL_TRAPS.length)
})

test('the practice estimate waits for enough answers, then narrows as they add up', () => {
  let state = freshState(DAY)
  assert.equal(practiceEstimate(state), null)
  const answer = (count: number, rightEvery: number) => {
    for (let i = 0; i < count; i++) state = recordAnswer(state, ALL_SKILLS[i % ALL_SKILLS.length], i % rightEvery !== 0, 'Medium')
  }
  answer(ESTIMATE_MIN_ANSWERS, 4) // three in four right
  const early = practiceEstimate(state)!
  assert.ok(early.low >= 200 && early.high <= 800 && early.low < early.mid && early.mid < early.high)
  answer(180, 4)
  const later = practiceEstimate(state)!
  assert.ok(later.high - later.low < early.high - early.low, 'more answers, tighter range')
  assert.equal(later.mid % 10, 0)
})

test('the estimate rewards harder questions and never treats Easy-only practice as a top score', () => {
  const run = (difficulty: 'Easy' | 'Hard') => {
    let state = freshState(DAY)
    for (let i = 0; i < 60; i++) state = recordAnswer(state, ALL_SKILLS[i % ALL_SKILLS.length], true, difficulty)
    return practiceEstimate(state)!
  }
  const easy = run('Easy')
  const hard = run('Hard')
  assert.ok(hard.mid > easy.mid, `${hard.mid} > ${easy.mid}`)
  assert.ok(easy.mid < 780, 'all-Easy practice is not read as a near-perfect score')
})
