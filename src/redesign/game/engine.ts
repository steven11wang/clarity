// The game rules, as pure functions over a plain GameState. Nothing here
// touches storage, React or the clock directly: callers pass `today` so the
// demo clock and the tests can move time.
//
// The one rule every function serves: a miss is worth more than a hit. A
// comeback beaten pays more XP and ink than a first-try answer, so the fastest
// way up the board is through the Mistake Notebook, never around it.

import type { TrapType } from '../../types.ts'
import {
  ALL_SKILLS,
  COMEBACK_DAYS,
  FOUNDER,
  LEAGUES,
  PATH,
  QUEST_TEMPLATES,
  RANKS,
  REWARDS,
  SAMPLE_RIVALS,
  STICKERS,
  type Difficulty,
  type OutfitId,
  type QuestKind,
  type Rank,
  type Rarity,
  type Sticker,
} from './content.ts'

export type MissEntry = {
  qid: string
  skill: string
  trap: TrapType | null
  addedDay: string
  dueDay: string
  stage: number // index into COMEBACK_DAYS of the *next* return
  beats: number
  cleared: boolean
}

export type QuestState = { kind: QuestKind; target: number; progress: number; claimed: boolean }

export type SkillStats = {
  answered: number
  correct: number
  stars: Partial<Record<Difficulty, boolean>>
}

export type GameState = {
  version: 1
  onboarded: boolean
  name: string
  targetScore: number
  dailyMinutes: number
  dayOffset: number // demo clock: whole days added to the real date
  xp: number
  ink: number
  streak: { count: number; best: number; lastDay: string | null; tapes: number; days: string[] }
  quests: { day: string; items: QuestState[] }
  weekly: { week: string; stamps: number; claimed: boolean }
  league: { week: string; xp: number; tier: number }
  misses: Record<string, MissEntry>
  skills: Record<string, SkillStats>
  completed: string[] // path node ids
  stickers: Record<string, number>
  packs: number
  pity: number
  outfit: OutfitId
  owned: OutfitId[]
  arena: { rp: number; wins: number; losses: number }
  log: Record<string, { pages: number; xp: number }>
  /** set once the student signs in or names a device profile */
  account?: Account
  /** friends saved after a match or from the Study Hall; kept on this device for now */
  friends?: Friend[]
  /** drop purchases, newest last; live ones mirror the server's record */
  purchases?: Purchase[]
  /** set when a founding-member code was entered */
  founder?: Founder
}

/** `day` is when the code was entered; study days from then count toward the goal. */
export type Founder = { day: string; goalPaid: boolean }

export type Account = { kind: 'cloud' | 'device'; userId?: string; email?: string }

/** A drop purchase. `test` ones come from the preview checkout and cost nothing. */
export type Purchase = {
  id: string
  packId: string
  drops: number
  cents: number
  at: number
  mode: 'test' | 'live'
  status: 'paid' | 'refunded'
}
export type Friend = { id: string; name: string; outfit: OutfitId; addedDay: string }

// ---------------------------------------------------------------------------
// Days

export function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + days))
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** Monday of the week the day falls in; the league and the weekly card reset on it. */
export function weekKey(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const shift = (date.getDay() + 6) % 7
  return dayKey(new Date(y, m - 1, d - shift))
}

export function today(state: Pick<GameState, 'dayOffset'>, now = new Date()): string {
  return addDays(dayKey(now), state.dayOffset)
}

// ---------------------------------------------------------------------------
// Seeded randomness, so a day's quests and a rival's pace are stable.

export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function seeded(seed: number): () => number {
  let a = seed || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Fresh state

export function freshState(day: string): GameState {
  return {
    version: 1,
    onboarded: false,
    name: '',
    targetScore: 1500,
    dailyMinutes: 10,
    dayOffset: 0,
    xp: 0,
    ink: 5,
    streak: { count: 0, best: 0, lastDay: null, tapes: 1, days: [] },
    quests: { day, items: questsFor(day) },
    // Endowed progress: the weekly card arrives with its first stamp already
    // on it, so the student starts one sixth of the way there, not at zero.
    weekly: { week: weekKey(day), stamps: 1, claimed: false },
    league: { week: weekKey(day), xp: 0, tier: 0 },
    misses: {},
    skills: Object.fromEntries(ALL_SKILLS.map((skill) => [skill, { answered: 0, correct: 0, stars: {} }])),
    completed: [],
    stickers: {},
    packs: 0,
    pity: 0,
    outfit: 'none',
    owned: ['none'],
    arena: { rp: 40, wins: 0, losses: 0 },
    log: {},
  }
}

export const WEEKLY_STAMPS = 6

/**
 * Roll the clock forward to `day`: refresh quests, reset the week, and settle
 * the streak — a missed day spends a roll of correction tape if one is left.
 */
export function rollover(state: GameState, day: string): GameState {
  let next = state
  if (next.quests.day !== day) next = { ...next, quests: { day, items: questsFor(day) } }

  const week = weekKey(day)
  if (next.weekly.week !== week) next = { ...next, weekly: { week, stamps: 1, claimed: false } }
  if (next.league.week !== week) {
    const placed = leagueStandings(next, day).findIndex((row) => row.you)
    const tier = placed > -1 && placed < 3 ? Math.min(next.league.tier + 1, LEAGUES.length - 1) : next.league.tier
    next = { ...next, league: { week, xp: 0, tier } }
  }

  const { lastDay } = next.streak
  if (lastDay && next.streak.count > 0) {
    const gap = daysBetween(lastDay, day)
    if (gap > 1) {
      const missed = gap - 1
      if (missed <= next.streak.tapes) {
        // Correction tape covers the gap: the streak survives, the tape is spent,
        // and the covered days are taped over in the calendar.
        const taped = Array.from({ length: missed }, (_, i) => `tape:${addDays(lastDay, i + 1)}`)
        next = {
          ...next,
          streak: {
            ...next.streak,
            tapes: next.streak.tapes - missed,
            lastDay: addDays(day, -1),
            days: [...next.streak.days, ...taped],
          },
        }
      } else {
        next = { ...next, streak: { ...next.streak, count: 0 } }
      }
    }
  }
  return next
}

// ---------------------------------------------------------------------------
// Levels: each level needs 50 XP more than the one before it.

export function levelInfo(xp: number) {
  let level = 1
  let floor = 0
  let need = 120
  while (xp >= floor + need) {
    floor += need
    level += 1
    need += 50
  }
  return { level, into: xp - floor, need, progress: (xp - floor) / need }
}

// ---------------------------------------------------------------------------
// Streak: one turned-in page a day keeps it. The daily goal is separate, so a
// short day still counts (Duolingo split the two and saw D14 retention rise).

export function markStudied(state: GameState, day: string): GameState {
  if (state.streak.lastDay === day) return state
  const continuing = state.streak.lastDay ? daysBetween(state.streak.lastDay, day) === 1 : false
  const count = continuing ? state.streak.count + 1 : 1
  // a seven-day run earns a roll of correction tape, holding at most two
  const tapes = count % 7 === 0 ? Math.min(2, state.streak.tapes + 1) : state.streak.tapes
  const stamps = Math.min(WEEKLY_STAMPS, state.weekly.stamps + 1)
  return settleFounderGoal({
    ...state,
    streak: { count, best: Math.max(state.streak.best, count), lastDay: day, tapes, days: [...state.streak.days, day] },
    weekly: { ...state.weekly, stamps },
  })
}

// ---------------------------------------------------------------------------
// Founding members

/** Entering the code: the Summer Scholar, the title, and the welcome drops. Once only. */
export function grantFounder(state: GameState, day: string): GameState {
  if (state.founder) return state
  return {
    ...state,
    founder: { day, goalPaid: false },
    ink: state.ink + FOUNDER.welcomeDrops,
    owned: state.owned.includes(FOUNDER.outfit) ? state.owned : [...state.owned, FOUNDER.outfit],
    outfit: FOUNDER.outfit,
  }
}

/** Study days since the code went in (the day itself counts). */
export function founderDays(state: GameState): number {
  const since = state.founder?.day
  if (!since) return 0
  return new Set(state.streak.days.filter((day) => day >= since)).size
}

/** The rest of the drops arrive on the tenth study day — days, not a streak. */
export function settleFounderGoal(state: GameState): GameState {
  if (!state.founder || state.founder.goalPaid || founderDays(state) < FOUNDER.goalDays) return state
  return { ...state, ink: state.ink + FOUNDER.goalDrops, founder: { ...state.founder, goalPaid: true } }
}

/** Daily goal in pages: about four and a half minutes a page. */
export function pagesGoal(state: GameState): number {
  return Math.max(1, Math.round(state.dailyMinutes / 5))
}

export function logPage(state: GameState, day: string, xp: number): GameState {
  const log = state.log ?? {}
  const entry = log[day] ?? { pages: 0, xp: 0 }
  return { ...state, log: { ...log, [day]: { pages: entry.pages + 1, xp: entry.xp + xp } } }
}

export function pagesOn(state: GameState, day: string): number {
  return state.log?.[day]?.pages ?? 0
}

// ---------------------------------------------------------------------------
// Comebacks

export function fileMiss(state: GameState, qid: string, skill: string, day: string): GameState {
  const existing = state.misses[qid]
  const entry: MissEntry = existing
    ? { ...existing, stage: 0, dueDay: addDays(day, COMEBACK_DAYS[0]), cleared: false }
    : { qid, skill, trap: null, addedDay: day, dueDay: addDays(day, COMEBACK_DAYS[0]), stage: 0, beats: 0, cleared: false }
  return { ...state, misses: { ...state.misses, [qid]: entry } }
}

export function nameTrap(state: GameState, qid: string, trap: TrapType): GameState {
  const entry = state.misses[qid]
  if (!entry) return state
  return { ...state, misses: { ...state.misses, [qid]: { ...entry, trap } } }
}

/** A comeback answered: beaten moves it a stage further out; missed sends it back to tomorrow. */
export function settleComeback(state: GameState, qid: string, correct: boolean, day: string): GameState {
  const entry = state.misses[qid]
  if (!entry) return state
  if (!correct) {
    return {
      ...state,
      misses: { ...state.misses, [qid]: { ...entry, stage: 0, dueDay: addDays(day, COMEBACK_DAYS[0]) } },
    }
  }
  const stage = entry.stage + 1
  const cleared = stage >= COMEBACK_DAYS.length
  return {
    ...state,
    misses: {
      ...state.misses,
      [qid]: {
        ...entry,
        stage: Math.min(stage, COMEBACK_DAYS.length - 1),
        beats: entry.beats + 1,
        cleared,
        dueDay: cleared ? entry.dueDay : addDays(day, COMEBACK_DAYS[stage]),
      },
    },
  }
}

export function dueComebacks(state: GameState, day: string): MissEntry[] {
  return Object.values(state.misses)
    .filter((entry) => !entry.cleared && daysBetween(entry.dueDay, day) >= 0)
    .sort((a, b) => a.dueDay.localeCompare(b.dueDay))
}

export function upcomingComebacks(state: GameState, day: string): MissEntry[] {
  return Object.values(state.misses)
    .filter((entry) => !entry.cleared && daysBetween(entry.dueDay, day) < 0)
    .sort((a, b) => a.dueDay.localeCompare(b.dueDay))
}

// ---------------------------------------------------------------------------
// XP, ink, quests

export function gain(state: GameState, xp: number, ink = 0): GameState {
  return {
    ...state,
    xp: state.xp + xp,
    ink: state.ink + ink,
    league: { ...state.league, xp: state.league.xp + xp },
  }
}

export function questsFor(day: string): QuestState[] {
  const rand = seeded(hash(`quests:${day}`))
  // 'turn-in-page' is always first: it is the one that keeps the streak
  const [always, ...rest] = QUEST_TEMPLATES
  const pool = [...rest]
  const picks = [always]
  while (picks.length < 3) picks.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  return picks.map((template) => ({ kind: template.kind, target: template.target, progress: 0, claimed: false }))
}

export function bumpQuest(state: GameState, kind: QuestKind, amount = 1): GameState {
  if (!state.quests.items.some((quest) => quest.kind === kind)) return state
  return {
    ...state,
    quests: {
      ...state.quests,
      items: state.quests.items.map((quest) =>
        quest.kind === kind ? { ...quest, progress: Math.min(quest.target, quest.progress + amount) } : quest,
      ),
    },
  }
}

export function claimQuest(state: GameState, kind: QuestKind): GameState {
  const quest = state.quests.items.find((item) => item.kind === kind)
  const template = QUEST_TEMPLATES.find((item) => item.kind === kind)
  if (!quest || !template || quest.claimed || quest.progress < quest.target) return state
  return {
    ...gain(state, 0, template.ink),
    quests: {
      ...state.quests,
      items: state.quests.items.map((item) => (item.kind === kind ? { ...item, claimed: true } : item)),
    },
  }
}

export function claimWeekly(state: GameState): GameState {
  if (state.weekly.claimed || state.weekly.stamps < WEEKLY_STAMPS) return state
  return { ...state, packs: state.packs + 2, ink: state.ink + 12, weekly: { ...state.weekly, claimed: true } }
}

// ---------------------------------------------------------------------------
// Sticker packs. Variable reward with a floor: the tenth pack without holo foil
// is guaranteed holo, so luck never decides whether effort pays.

export const PITY = 10
const ODDS: Array<[Rarity, number]> = [
  ['holo', 0.06],
  ['gloss', 0.34],
  ['plain', 0.6],
]

export function drawSticker(state: GameState, rand: () => number): { state: GameState; sticker: Sticker } {
  let rarity: Rarity = 'plain'
  if (state.pity + 1 >= PITY) {
    rarity = 'holo'
  } else {
    let roll = rand()
    for (const [tier, odds] of ODDS) {
      if (roll < odds) {
        rarity = tier
        break
      }
      roll -= odds
    }
  }
  const pool = STICKERS.filter((sticker) => sticker.rarity === rarity)
  // prefer one the student does not have yet, half of the time
  const missing = pool.filter((sticker) => !state.stickers[sticker.id])
  const from = missing.length > 0 && rand() < 0.5 ? missing : pool
  const sticker = from[Math.floor(rand() * from.length)]
  const owned = sticker.outfit && !state.owned.includes(sticker.outfit) ? [...state.owned, sticker.outfit] : state.owned
  return {
    sticker,
    state: {
      ...state,
      packs: Math.max(0, state.packs - 1),
      pity: rarity === 'holo' ? 0 : state.pity + 1,
      stickers: { ...state.stickers, [sticker.id]: (state.stickers[sticker.id] ?? 0) + 1 },
      owned,
    },
  }
}

// ---------------------------------------------------------------------------
// Skills and the path

export function recordAnswer(state: GameState, skill: string, correct: boolean): GameState {
  const stats = state.skills[skill] ?? { answered: 0, correct: 0, stars: {} }
  return {
    ...state,
    skills: { ...state.skills, [skill]: { ...stats, answered: stats.answered + 1, correct: stats.correct + (correct ? 1 : 0) } },
  }
}

/** A page counts as a star at its difficulty when at least 4 of 5 were right first time. */
export function awardStar(state: GameState, skill: string, difficulty: Difficulty, right: number, total: number): GameState {
  if (right / total < 0.8) return state
  const stats = state.skills[skill] ?? { answered: 0, correct: 0, stars: {} }
  return { ...state, skills: { ...state.skills, [skill]: { ...stats, stars: { ...stats.stars, [difficulty]: true } } } }
}

export function completeNode(state: GameState, nodeId: string): GameState {
  if (state.completed.includes(nodeId)) return state
  const node = PATH.find((item) => item.id === nodeId)
  const packs = node?.kind === 'chest' ? state.packs + 3 : state.packs
  return { ...state, completed: [...state.completed, nodeId], packs }
}

/** The first node not yet completed: the one the path pulses on. */
export function currentNode(state: GameState) {
  return PATH.find((node) => !state.completed.includes(node.id)) ?? PATH[PATH.length - 1]
}

/**
 * Every section opens on its first stop, so a student can start in the domain
 * they need; inside a section, each stop opens when the one before it is done.
 */
export function isUnlocked(state: GameState, nodeId: string): boolean {
  const node = PATH.find((item) => item.id === nodeId)
  if (!node) return false
  if (state.completed.includes(node.id)) return true
  const section = PATH.filter((item) => item.domainId === node.domainId)
  const index = section.indexOf(node)
  return index === 0 || state.completed.includes(section[index - 1].id)
}

/** The first open, unfinished stop in a section: where that section picks up. */
export function sectionNext(state: GameState, domainId: string) {
  return PATH.find((item) => item.domainId === domainId && !state.completed.includes(item.id) && isUnlocked(state, item.id)) ?? null
}

export function starCount(state: GameState): number {
  return Object.values(state.skills).reduce((sum, stats) => sum + Object.values(stats.stars).filter(Boolean).length, 0)
}

/** 0–1 skill strength for the radar: accuracy, pulled toward 0 until enough answers exist. */
export function skillStrength(stats: SkillStats | undefined): number {
  if (!stats || stats.answered === 0) return 0
  const confidence = Math.min(1, stats.answered / 10)
  return (stats.correct / stats.answered) * confidence
}

// ---------------------------------------------------------------------------
// Speed Round ranks

export function rankFor(rp: number): { rank: Rank; next: Rank | null; progress: number } {
  let index = 0
  RANKS.forEach((rank, i) => {
    if (rp >= rank.min) index = i
  })
  const rank = RANKS[index]
  const next = RANKS[index + 1] ?? null
  const progress = next ? (rp - rank.min) / (next.min - rank.min) : 1
  return { rank, next, progress }
}

export function settleSpeedRound(state: GameState, won: boolean): GameState {
  const rp = Math.max(0, state.arena.rp + (won ? REWARDS.speedWinRp : REWARDS.speedLossRp))
  const arena = { rp, wins: state.arena.wins + (won ? 1 : 0), losses: state.arena.losses + (won ? 0 : 1) }
  const next = { ...state, arena }
  return won ? bumpQuest(gain(next, REWARDS.speedWinXp, REWARDS.speedWinInk), 'win-speed') : gain(next, 8, 1)
}

// ---------------------------------------------------------------------------
// The weekly study group. Rivals are sample data with a steady pace, so the
// board moves as the week goes on; the student is placed among them by XP.
// Paced so two pages a day reaches the top three: a league nobody can climb
// teaches nobody to come back.

export type LeagueRow = { name: string; xp: number; pet: OutfitId; you: boolean }

export function leagueStandings(state: GameState, day: string): LeagueRow[] {
  const elapsed = daysBetween(state.league.week, day) + 1 // 1..7
  const scale = 1 + state.league.tier * 0.35
  const rows: LeagueRow[] = SAMPLE_RIVALS.map((rival) => {
    const jitter = seeded(hash(`${state.league.week}:${rival.name}`))()
    return { name: rival.name, pet: rival.pet, you: false, xp: Math.round(rival.pace * scale * elapsed * (16 + jitter * 22)) }
  })
  rows.push({ name: state.name || 'You', xp: state.league.xp, pet: state.outfit, you: true })
  return rows.sort((a, b) => b.xp - a.xp || (a.you ? -1 : 1))
}
