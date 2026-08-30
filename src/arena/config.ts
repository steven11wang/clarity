// The Arena's fixed numbers, in one place: the ladder, the clock, the scoring,
// and the three ways to enter a match. Everything here is presentation-free so
// the model and the panels can both read it.

export const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Apex'] as const
export const DIVISIONS = ['III', 'II', 'I'] as const

export type Tier = (typeof TIERS)[number]
export type Division = (typeof DIVISIONS)[number]

// A rank is a point on one ladder, written as three coordinates so the crest
// can render tier and division without recomputing them. Stars are the rungs
// inside a division: three of them and you move up.
export type Rank = {
  tier: number
  division: number
  stars: number
}

export const STARS_PER_DIVISION = 3
export const BASE_RANK: Rank = { tier: 0, division: 0, stars: 0 }
export const MAX_RANK_SCORE =
  (TIERS.length * DIVISIONS.length - 1) * STARS_PER_DIVISION + (STARS_PER_DIVISION - 1)

// One colour per tier, warm to cool up the ladder.
export const TIER_COLORS = [
  '#b98552',
  '#abb8c4',
  '#d5b96d',
  '#6faaa3',
  '#7994b8',
  '#d08c78',
]

export const QUESTIONS_PER_BATTLE = 5
export const QUESTION_TIME_MS = 45_000
export const COUNTDOWN_SECONDS = 3
export const QUEUE_TIMEOUT_MS = 10_000
export const XP_PER_LEVEL = 500
export const HISTORY_LIMIT = 20

export type ArenaMode = 'ranked' | 'blitz' | 'overreach'

export const DIFFICULTY_CHOICES = ['Mixed', 'Easy', 'Medium', 'Hard'] as const

// The avatars the Arena draws from. Wider than the sign-in shortcut set: the
// bot opponents pull names and faces from here too, and every file has an AVIF
// under art/arena. A missing image falls back to the glyph.
export const ARENA_AVATARS = [
  { id: 'orbit', label: 'Orbit', glyph: '◒' },
  { id: 'spark', label: 'Spark', glyph: '✦' },
  { id: 'wave', label: 'Wave', glyph: '≈' },
  { id: 'mira', label: 'Mira', glyph: '◈' },
  { id: 'theo', label: 'Theo', glyph: '◐' },
  { id: 'nia', label: 'Nia', glyph: '✧' },
  { id: 'rune', label: 'Rune', glyph: '◇' },
] as const

export const AVATAR_GLYPHS: Record<string, string> = Object.fromEntries(
  ARENA_AVATARS.map((avatar) => [avatar.id, avatar.glyph]),
)

// Training opponents are named, not numbered - a match against "Nova Reyes"
// reads like a match, and the name is derived from the match seed so the same
// battle always shows the same rival.
export const BOT_NAMES = [
  'Ash Ferrell',
  'Nova Reyes',
  'Kite Munro',
  'Sable Okonkwo',
  'Wren Halliday',
  'Onyx Baptiste',
  'Juno Castellan',
  'Rook Delacroix',
  'Vesper Adeyemi',
  'Lark Whitfield',
]
