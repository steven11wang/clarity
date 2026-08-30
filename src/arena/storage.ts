import { storage } from '../storage/index.ts'
import { HISTORY_LIMIT } from './config.ts'
import { emptyProfile, seasonIdFor, type ArenaProfile, type MatchHistoryEntry } from './model.ts'

const PROFILE_KEY = 'arena-profile'
const HISTORY_KEY = 'arena-history'

function readProfile(): ArenaProfile | null {
  const stored = storage.get<ArenaProfile>(PROFILE_KEY)
  if (!stored || typeof stored !== 'object') return null
  const rank = stored.rank
  if (!rank || typeof rank.tier !== 'number' || typeof rank.division !== 'number') return null
  return stored
}

// A new season resets the ladder but keeps XP: the rank is a statement about
// this quarter, the level is a statement about all the work.
export function loadArenaProfile(at: number): ArenaProfile {
  const seasonId = seasonIdFor(at)
  const stored = readProfile()
  if (!stored) return emptyProfile(seasonId)
  if (stored.seasonId === seasonId) return stored
  return { ...emptyProfile(seasonId), xp: stored.xp }
}

export function saveArenaProfile(profile: ArenaProfile): void {
  storage.set(PROFILE_KEY, profile)
}

export function loadArenaHistory(): MatchHistoryEntry[] {
  const stored = storage.get<MatchHistoryEntry[]>(HISTORY_KEY)
  return Array.isArray(stored) ? stored : []
}

export function recordArenaMatch(entry: MatchHistoryEntry): void {
  storage.set(HISTORY_KEY, [entry, ...loadArenaHistory()].slice(0, HISTORY_LIMIT))
}
