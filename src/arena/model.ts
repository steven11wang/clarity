import type { Question } from '../types.ts'
import {
  BASE_RANK,
  BOT_NAMES,
  DIVISIONS,
  MAX_RANK_SCORE,
  QUESTION_TIME_MS,
  STARS_PER_DIVISION,
  TIERS,
  TIER_COLORS,
  XP_PER_LEVEL,
  type ArenaMode,
  type Rank,
} from './config.ts'

export type { Rank } from './config.ts'

export type ArenaProfile = {
  rank: Rank
  xp: number
  wins: number
  losses: number
  draws: number
  streak: number
  seasonId: string
  lastMatchAt: number | null
}

export type MatchOutcome = 'win' | 'loss' | 'draw'

export type RankChange = {
  rank: Rank
  starDelta: number
  moved: boolean
  promoted: boolean
  demoted: boolean
}

export type MatchConfig = {
  domain: string
  difficulty: string
  count: number
}

export type ArenaOpponent = {
  id: string
  name: string
  avatarId: string
  rankLabel: string
  isBot: boolean
}

export type MatchSession = {
  matchId: string
  seed: string
  questionIds: string[]
  config: MatchConfig
  opponent: ArenaOpponent
  role: 'host' | 'guest'
}

export type MatchHistoryEntry = {
  matchId: string
  finishedAt: number
  domain: string
  difficulty: string
  outcome: MatchOutcome
  points: number
  opponentPoints: number
  correct: number
  opponentCorrect: number
  opponentName: string
  opponentIsBot: boolean
  xpGained: number
  rankLabel: string
}

// --- Seeded randomness --------------------------------------------------------
// Both sides of a live match derive their question order from the same match
// seed, so neither client has to send the questions themselves.

export function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 1831565813) >>> 0
    let x = state
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  const next = seededRandom(hashSeed(seed))
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// --- The ladder ---------------------------------------------------------------
// One integer runs the whole ladder: stars within a division, divisions within
// a tier, tiers up the board. Promotion and demotion fall out of the arithmetic
// instead of needing their own rules.

export function rankScore(rank: Rank): number {
  return (rank.tier * DIVISIONS.length + rank.division) * STARS_PER_DIVISION + rank.stars
}

export function rankFromScore(score: number): Rank {
  const clamped = Math.max(0, Math.min(MAX_RANK_SCORE, score))
  const stars = clamped % STARS_PER_DIVISION
  const step = Math.floor(clamped / STARS_PER_DIVISION)
  return {
    tier: Math.floor(step / DIVISIONS.length),
    division: step % DIVISIONS.length,
    stars,
  }
}

export function rankLabel(rank: Rank): string {
  return `${TIERS[rank.tier]} ${DIVISIONS[rank.division]}`
}

export function tierColor(tier: number): string {
  return TIER_COLORS[Math.max(0, Math.min(TIER_COLORS.length - 1, tier))]
}

export function applyRankChange(rank: Rank, outcome: MatchOutcome): RankChange {
  if (outcome === 'draw') {
    return { rank, starDelta: 0, moved: false, promoted: false, demoted: false }
  }
  const delta = outcome === 'win' ? 1 : -1
  const next = rankFromScore(rankScore(rank) + delta)
  const moved = rankScore(next) !== rankScore(rank)
  const crossed = next.division !== rank.division || next.tier !== rank.tier
  return {
    rank: next,
    starDelta: delta,
    moved,
    promoted: crossed && delta === 1,
    demoted: crossed && delta === -1,
  }
}

// --- Scoring ------------------------------------------------------------------
// A correct answer is worth 10, plus up to 10 more for how much of the clock is
// left. A wrong answer is worth nothing, so speed never outranks accuracy.

export function pointsFor(correct: boolean, elapsedMs: number, limitMs = QUESTION_TIME_MS): number {
  if (!correct) return 0
  const remaining = limitMs <= 0 ? 0 : (limitMs - Math.max(0, Math.min(limitMs, elapsedMs))) / limitMs
  return 10 + Math.round(10 * remaining)
}

export function xpFor(points: number, correct: number, outcome: MatchOutcome): number {
  return points + (outcome === 'win' ? 60 : outcome === 'draw' ? 30 : 0) + correct * 8
}

export function levelFor(xp: number) {
  return {
    level: Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1,
    into: Math.max(0, xp) % XP_PER_LEVEL,
    need: XP_PER_LEVEL,
  }
}

// --- Seasons ------------------------------------------------------------------
// The ladder resets each quarter; XP carries over, so a season reset costs you
// rank without erasing the record of the work.

export function seasonIdFor(at: number): string {
  const date = new Date(at)
  return `${date.getUTCFullYear()}-S${Math.floor(date.getUTCMonth() / 3) + 1}`
}

export function seasonLabel(seasonId: string): string {
  const [year, season] = seasonId.split('-S')
  return `Season ${season} · ${year}`
}

export function emptyProfile(seasonId: string): ArenaProfile {
  return {
    rank: { ...BASE_RANK },
    xp: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    seasonId,
    lastMatchAt: null,
  }
}

// --- The battle ---------------------------------------------------------------

export type SideState = {
  points: number
  correct: number
  answered: number
  finished: boolean
}

export type BattleRecord = {
  questionId: string
  choice: string | null
  correct: boolean
  points: number
  elapsedMs: number
}

export type BattleState = {
  // `standby` is the gap where you have finished and the rival has not.
  phase: 'countdown' | 'question' | 'standby' | 'complete'
  index: number
  total: number
  mine: SideState
  theirs: SideState
  records: BattleRecord[]
}

export type BattleAction =
  | { type: 'reset'; total: number }
  | { type: 'countdown-done' }
  | { type: 'answer'; questionId: string; choice: string | null; correct: boolean; elapsedMs: number }
  | { type: 'opponent-answer'; index: number; correct: boolean; points: number }
  | { type: 'opponent-finished' }
  | { type: 'forfeit' }

const emptySide = (): SideState => ({ points: 0, correct: 0, answered: 0, finished: false })

export function initialBattle(total: number): BattleState {
  return { phase: 'countdown', index: 0, total, mine: emptySide(), theirs: emptySide(), records: [] }
}

function settlePhase(state: BattleState): BattleState {
  if (state.mine.finished && state.theirs.finished) return { ...state, phase: 'complete' }
  if (state.mine.finished) return { ...state, phase: 'standby' }
  return state
}

export function battleReducer(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case 'reset':
      return initialBattle(action.total)
    case 'countdown-done':
      return state.phase === 'countdown' ? { ...state, phase: 'question' } : state
    case 'answer': {
      if (state.phase !== 'question' || state.mine.finished) return state
      const points = pointsFor(action.correct, action.elapsedMs)
      const index = state.index + 1
      const finished = index >= state.total
      return settlePhase({
        ...state,
        index,
        phase: finished ? state.phase : 'question',
        mine: {
          points: state.mine.points + points,
          correct: state.mine.correct + (action.correct ? 1 : 0),
          answered: state.mine.answered + 1,
          finished,
        },
        records: [
          ...state.records,
          {
            questionId: action.questionId,
            choice: action.choice,
            correct: action.correct,
            points,
            elapsedMs: action.elapsedMs,
          },
        ],
      })
    }
    case 'opponent-answer': {
      // Broadcasts can arrive twice or out of order; the index is the guard.
      if (state.theirs.finished || action.index < state.theirs.answered) return state
      const answered = state.theirs.answered + 1
      return settlePhase({
        ...state,
        theirs: {
          points: state.theirs.points + action.points,
          correct: state.theirs.correct + (action.correct ? 1 : 0),
          answered,
          finished: answered >= state.total,
        },
      })
    }
    case 'opponent-finished':
      return settlePhase({ ...state, theirs: { ...state.theirs, finished: true } })
    case 'forfeit':
      // Someone left. Freeze both sides and score what is on the board.
      return {
        ...state,
        phase: 'complete',
        mine: { ...state.mine, finished: true },
        theirs: { ...state.theirs, finished: true },
      }
    default:
      return state
  }
}

// Points decide it; a tie on points falls back to raw correct answers, so the
// faster player does not win a match they answered worse.
export function compareSides(mine: SideState, theirs: SideState): MatchOutcome {
  if (mine.points !== theirs.points) return mine.points > theirs.points ? 'win' : 'loss'
  if (mine.correct !== theirs.correct) return mine.correct > theirs.correct ? 'win' : 'loss'
  return 'draw'
}

export function battleOutcome(state: BattleState): MatchOutcome {
  return compareSides(state.mine, state.theirs)
}

export function settleMatch(
  profile: ArenaProfile,
  result: { outcome: MatchOutcome; points: number; correct: number; at: number },
): { profile: ArenaProfile; change: RankChange; xpGained: number } {
  const change = applyRankChange(profile.rank, result.outcome)
  const xpGained = xpFor(result.points, result.correct, result.outcome)
  return {
    profile: {
      ...profile,
      rank: change.rank,
      xp: profile.xp + xpGained,
      wins: profile.wins + (result.outcome === 'win' ? 1 : 0),
      losses: profile.losses + (result.outcome === 'loss' ? 1 : 0),
      draws: profile.draws + (result.outcome === 'draw' ? 1 : 0),
      streak: result.outcome === 'win' ? Math.max(0, profile.streak) + 1 : 0,
      lastMatchAt: result.at,
    },
    change,
    xpGained,
  }
}

// --- Question pools -----------------------------------------------------------

export function filterPool(questions: Question[], config: MatchConfig): Question[] {
  return questions.filter((question) => {
    if (config.domain !== 'Mixed' && question.domain !== config.domain) return false
    if (config.difficulty !== 'Mixed' && question.difficulty !== config.difficulty) return false
    return true
  })
}

export function drawQuestions(questions: Question[], config: MatchConfig, seed: string): Question[] {
  return seededShuffle(filterPool(questions, config), seed).slice(0, config.count)
}

export function questionsByIds(questions: Question[], ids: string[]): Question[] {
  const byId = new Map(questions.map((question) => [question.id, question]))
  return ids.flatMap((id) => {
    const question = byId.get(id)
    return question ? [question] : []
  })
}

// --- Training opponents -------------------------------------------------------

export type BotProfile = { accuracy: number; paceMs: number }

// A bot's skill is read off your own rank, so the training opponent stays
// roughly level with you as you climb. Overreach adds a handicap on top.
export function botProfileFor(score: number, maxScore = MAX_RANK_SCORE): BotProfile {
  const share = maxScore <= 0 ? 0 : Math.max(0, Math.min(1, score / maxScore))
  return { accuracy: 0.52 + share * 0.38, paceMs: 26_000 - share * 12_000 }
}

export type BotBeat = { index: number; atMs: number; correct: boolean; points: number }

// The whole bot match is scripted up front from the seed: what it gets right
// and when each answer lands. Nothing about it reacts to your answers, so it
// cannot be gamed by stalling.
export function scriptBot(seed: string, total: number, profile: BotProfile): BotBeat[] {
  const next = seededRandom(hashSeed(`${seed}:bot`))
  const beats: BotBeat[] = []
  let elapsed = 0
  for (let index = 0; index < total; index += 1) {
    const jitter = 0.55 + next() * 0.9
    const takenMs = Math.max(2500, Math.min(QUESTION_TIME_MS - 500, profile.paceMs * jitter))
    const correct = next() < profile.accuracy
    elapsed += takenMs
    beats.push({ index, atMs: Math.round(elapsed), correct, points: pointsFor(correct, takenMs) })
  }
  return beats
}

export function botIdentity(seed: string) {
  const next = seededRandom(hashSeed(`${seed}:name`))
  return {
    name: BOT_NAMES[Math.floor(next() * BOT_NAMES.length)],
    avatarSeed: Math.floor(next() * 4),
  }
}

export function modeConfig(mode: ArenaMode, domain: string, difficulty: string, count: number): MatchConfig {
  // Blitz throws the filters away; Overreach pins difficulty to Hard. Only
  // Ranked lets you pick the ground.
  return {
    domain: mode === 'blitz' ? 'Mixed' : domain,
    difficulty: mode === 'blitz' ? 'Mixed' : mode === 'overreach' ? 'Hard' : difficulty,
    count,
  }
}
