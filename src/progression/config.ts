export const SAT_DOMAINS = [
  'Information and Ideas',
  'Craft and Structure',
  'Expression of Ideas',
  'Standard English Conventions',
] as const

export type SatDomain = (typeof SAT_DOMAINS)[number]

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const LEVELS = ['Noobie', 'Adventurer', 'Master'] as const
export type Level = (typeof LEVELS)[number]
export type CharacterStage = Level | 'Completed'

const DIFFICULTY_LEVEL: Record<Difficulty, Level> = {
  Easy: 'Noobie',
  Medium: 'Adventurer',
  Hard: 'Master',
}

const LEVEL_DIFFICULTY: Record<Level, Difficulty> = {
  Noobie: 'Easy',
  Adventurer: 'Medium',
  Master: 'Hard',
}

export function difficultyToLevel(difficulty: Difficulty): Level {
  return DIFFICULTY_LEVEL[difficulty]
}

export function levelToDifficulty(level: Level): Difficulty {
  return LEVEL_DIFFICULTY[level]
}

export function lowerLevel(level: Level): Level | null {
  const index = LEVELS.indexOf(level)
  return index > 0 ? LEVELS[index - 1] : null
}

export function levelRank(level: Level): number {
  return LEVELS.indexOf(level)
}

export type DomainPresentation = {
  shortName: string
  characterName: string
  characterRole: string
  accent: string
  accentSoft: string
  description: string
}

// Domain presentation is the only static domain metadata. Skill membership and
// question availability are always derived from the loaded question bank.
export const DOMAIN_PRESENTATION: Record<SatDomain, DomainPresentation> = {
  'Information and Ideas': {
    shortName: 'Information',
    characterName: 'Mira',
    characterRole: 'evidence scout',
    accent: '#B3382B',
    accentSoft: 'rgba(179,56,43,0.12)',
    description: 'Learn to find the main idea of a text and the details that support it. You will practice drawing careful conclusions from what the text actually says.',
  },
  'Craft and Structure': {
    shortName: 'Craft',
    characterName: 'Theo',
    characterRole: 'language explorer',
    accent: '#4A6B8A',
    accentSoft: 'rgba(74,107,138,0.14)',
    description: 'Learn why an author picks certain words and how a text is put together. You will practice spotting purpose, structure, and how two texts connect.',
  },
  'Expression of Ideas': {
    shortName: 'Expression',
    characterName: 'Nia',
    characterRole: 'idea builder',
    accent: '#3F7D72',
    accentSoft: 'rgba(63,125,114,0.14)',
    description: 'Learn to make writing clearer and stronger. You will practice choosing transitions that connect ideas and combining notes into one smooth point.',
  },
  'Standard English Conventions': {
    shortName: 'Conventions',
    characterName: 'Sol',
    characterRole: 'sentence engineer',
    accent: '#9A7B3F',
    accentSoft: 'rgba(154,123,63,0.16)',
    description: 'Learn the rules that make a sentence correct. You will practice punctuation, verb forms, and sentence structure until the right choice feels natural.',
  },
}
