export type FigureType = 'graph' | 'table'

export type TableData = {
  headers: string[]
  rows: string[][]
}

export type FigureData = {
  has_figure: true
  figure_type: FigureType
  image: string
  figure_description: string
  table?: TableData
}

export type Question = {
  id: string
  assessment: string
  test: string
  domain: string
  skill: string
  difficulty: string
  passage: string
  prompt: string
  choices: Record<'A' | 'B' | 'C' | 'D', string>
  answer: 'A' | 'B' | 'C' | 'D'
  rationale: string
  has_figure?: boolean
  figure_type?: FigureType
  image?: string
  figure_description?: string
  table?: TableData
}

export type Attempt = {
  questionId: string
  timestamp: number
  chosen: string
  correct: boolean
  confidence: 'sure' | 'leaning' | 'guessing' | null
  attemptsToCorrect: number
  errorCause:
    | 'misread-passage'
    | 'misread-question'
    | 'trap'
    | 'knowledge-gap'
    | 'rushed'
    | null
  selfExplanations: {
    whyWrong: string
    whyRight: string
    selfGrade: 'matched' | 'partly' | 'missed' | null
  } | null
  evidenceUnderlined: number[]
  evidenceScore: 'full' | 'partial' | 'miss' | null
  chainBreakLink: 'fact' | 'question' | 'answer' | null
  trapGuess: string | null
  trapActual: string | null
  hiddenError: boolean
  resurrectionStage: number
}
