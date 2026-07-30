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
    accent: '#3f766c',
    accentSoft: '#dcece7',
    description: 'Find the central claim, draw careful inferences, and follow the evidence.',
  },
  'Craft and Structure': {
    shortName: 'Craft',
    characterName: 'Theo',
    characterRole: 'language explorer',
    accent: '#617395',
    accentSoft: '#e3e8f1',
    description: 'Track purpose, structure, word choice, and connections between texts.',
  },
  'Expression of Ideas': {
    shortName: 'Expression',
    characterName: 'Nia',
    characterRole: 'idea builder',
    accent: '#a26c48',
    accentSoft: '#f2e5dc',
    description: 'Shape ideas with precise transitions and purposeful synthesis.',
  },
  'Standard English Conventions': {
    shortName: 'Conventions',
    characterName: 'Sol',
    characterRole: 'sentence engineer',
    accent: '#78658b',
    accentSoft: '#ebe5f0',
    description: 'Build clear sentences with sound boundaries, form, structure, and sense.',
  },
}
