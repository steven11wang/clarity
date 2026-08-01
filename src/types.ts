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
  notes?: string[] // research notes (e.g. Rhetorical Synthesis), rendered as a list
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

export type Confidence = 'sure' | 'leaning' | 'guessing'

export type ErrorCause =
  | 'misread-passage'
  | 'misread-question'
  | 'trap'
  | 'knowledge-gap'
  | 'rushed'

export type SelfGrade = 'matched' | 'partly' | 'missed'

export type EvidenceScore = 'full' | 'partial' | 'miss'

export type ChainLink = 'fact' | 'question' | 'answer'

export type TrapType =
  | 'too-extreme'
  | 'half-right'
  | 'true-but-irrelevant'
  | 'out-of-scope'
  | 'opposite'

export type SelfExplanations = {
  whyWrong: string
  whyRight: string
  selfGrade: SelfGrade | null
}

// What the student commits during the answer pass — a choice + confidence, no
// feedback. Missed ones flow into the review pass; the rest are logged as-is.
export type FirstPass = {
  chosen: string // '' when the clock ran out with nothing selected
  confidence: Confidence | null
  correct: boolean
  timeMs: number | null
  timedOut: boolean
  struckChoices: string[] // choices crossed out during the answer pass, for the review to show back
}

// The persisted record of one completed question attempt. Every field the
// Clarity loop can produce lives here; a first-try-correct attempt simply
// leaves the diagnosis fields null.
export type Attempt = {
  questionId: string
  timestamp: number
  chosen: string
  correct: boolean
  confidence: Confidence | null
  attemptsToCorrect: number
  errorCause: ErrorCause | null
  selfExplanations: SelfExplanations | null
  evidenceUnderlined: number[]
  evidenceScore: EvidenceScore | null
  chainBreakLink: ChainLink | null
  trapGuess: string | null
  trapActual: string | null
  hiddenError: boolean
  resurrectionStage: number
  // Timed mode: how long the answering phase took, and whether the clock ran
  // out before the student committed. null / false when not in timed mode.
  timeSpentMs: number | null
  timedOut: boolean
  // Optional context for fixed-unit adaptive practice. Legacy attempts omit
  // these fields, so existing persisted records remain valid.
  activityId?: string
  activityKind?: 'diagnostic' | 'skill' | 'checkpoint'
  practiceLevel?: 'Noobie' | 'Adventurer' | 'Master'
}

// A question scheduled to resurface. Lives in its own store, keyed by
// questionId, so the practice stream can weave due items back in.
export type ReviewItem = {
  questionId: string
  createdAt: number
  dueAt: number
  stage: number // index into REVIEW_INTERVALS; -1 once retired
  reason: 'miss' | 'hidden-error' | 'timeout'
  clears: number // consecutive correct-with-correct-evidence resurfacings
  lastReviewedAt: number | null
}
