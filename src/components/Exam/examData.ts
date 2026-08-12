import { assetPath } from '../../lib/assetPath.ts'

export type ExamChoice = {
  letter: string
  text: string
}

export type ExamFigure = {
  alt: string
  /** Path relative to the practice-exam data folder. */
  src: string
}

/** A data table that sits above the passage, the way the real app shows one. */
export type ExamTable = {
  caption: string | null
  headers: string[]
  rows: string[][]
}

export type ExamDifficulty = 'easy' | 'medium' | 'hard' | 'extreme'

/** Why the key works and why each distractor fails, keyed by choice letter. */
export type ExamExplanation = {
  summary: string
  choices: Record<string, string>
}

export type ExamQuestion = {
  id: string
  number: number
  passage: string[]
  figure: ExamFigure | null
  /** null unless the question hangs off a data table. */
  table?: ExamTable | null
  stem: string
  choices: ExamChoice[]
  /** null when the bank ships without a key for this item. */
  answer: string | null
  /** Skill domain, e.g. 'Craft and Structure'. null on untagged banks. */
  topic?: string | null
  /** Skill inside the domain, e.g. 'Words in Context'. */
  subtopic?: string | null
  difficulty?: ExamDifficulty | null
  /** null on banks that ship without written explanations. */
  explanation?: ExamExplanation | null
}

export const DIFFICULTY_LABEL: Record<ExamDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  extreme: 'Extreme',
}

export type ExamModule = {
  id: string
  number: number
  subject: string
  label: string
  durationSeconds: number
  questions: ExamQuestion[]
}

export type PracticeExam = {
  id: string
  title: string
  section: string
  subject: string
  /** 'official' when the key came with the exam, 'derived' when Clarity wrote it. */
  answerKeySource: 'official' | 'derived'
  assetBase: string
  modules: ExamModule[]
}

/** How long each module runs. `scaled` stretches the official clock. */
export type ExamTiming =
  | { kind: 'scaled'; factor: number; label: string }
  | { kind: 'fixed'; minutesPerModule: number; label: string }
  | { kind: 'untimed'; label: string }

export type ExamPaceOption = {
  id: string
  label: string
  hint: string
  timing: (customMinutes: number) => ExamTiming
}

export const EXAM_PACE_OPTIONS: ExamPaceOption[] = [
  {
    id: 'official',
    label: 'Official pace',
    hint: 'The same clock the real section runs on.',
    timing: () => ({ kind: 'scaled', factor: 1, label: 'Official pace' }),
  },
  {
    id: 'extended',
    label: 'Extended time',
    hint: '1.5× the official clock — the common accommodation.',
    timing: () => ({ kind: 'scaled', factor: 1.5, label: 'Extended time (1.5×)' }),
  },
  {
    id: 'double',
    label: 'Double time',
    hint: '2× the official clock, for building accuracy first.',
    timing: () => ({ kind: 'scaled', factor: 2, label: 'Double time (2×)' }),
  },
  {
    id: 'custom',
    label: 'Custom',
    hint: 'Pick your own minutes per module.',
    timing: (minutes) => ({
      kind: 'fixed',
      minutesPerModule: minutes,
      label: `${minutes} minutes per module`,
    }),
  },
  {
    id: 'untimed',
    label: 'Untimed',
    hint: 'No countdown. The clock counts up so you still see your pace.',
    timing: () => ({ kind: 'untimed', label: 'Untimed' }),
  },
]

export const CUSTOM_MINUTES_MIN = 5
export const CUSTOM_MINUTES_MAX = 180

/** Seconds on the clock for this module, or null when the run is untimed. */
export function moduleDurationSeconds(
  module: ExamModule,
  timing: ExamTiming,
): number | null {
  if (timing.kind === 'untimed') return null
  if (timing.kind === 'fixed') return Math.round(timing.minutesPerModule * 60)
  return Math.round(module.durationSeconds * timing.factor)
}

/** Whole-exam length in minutes, or null when the run is untimed. */
export function examDurationMinutes(
  exam: PracticeExam,
  timing: ExamTiming,
): number | null {
  if (timing.kind === 'untimed') return null
  return Math.round(
    exam.modules.reduce(
      (sum, module) => sum + (moduleDurationSeconds(module, timing) ?? 0),
      0,
    ) / 60,
  )
}

const EXAM_DIR = '/data/practice-exams'

export function examAssetPath(src: string): string {
  return assetPath(`${EXAM_DIR}/${src}`)
}

/**
 * Every exam the programme can run, in the order a student meets them. The
 * counts are stated here so the programme page can be drawn without pulling
 * five exam files over the wire; the file itself is fetched on start.
 */
export const EXAM_CATALOG = [
  { id: 'kaplan-diagnostic', title: 'Diagnostic', source: 'Kaplan', questions: 54, modules: 2 },
  { id: 'cooksat-test-1', title: 'Practice Test 1', source: 'CookSAT', questions: 54, modules: 2 },
  { id: 'cooksat-mock-exam-2', title: 'Practice Test 2', source: 'CookSAT', questions: 54, modules: 2 },
  { id: 'dsat-june-2026-exam-1', title: 'Practice Test 3', source: 'June 2026 bank', questions: 54, modules: 2 },
  { id: 'dsat-aug-2025-us-v2', title: 'Practice Test 4', source: 'August 2025 US', questions: 54, modules: 2 },
] as const

export type ExamCatalogId = (typeof EXAM_CATALOG)[number]['id']

const cache = new Map<string, Promise<PracticeExam>>()

export function loadPracticeExam(examId: string): Promise<PracticeExam> {
  const cached = cache.get(examId)
  if (cached) return cached

  const request = fetch(assetPath(`${EXAM_DIR}/${examId}.json`)).then((response) => {
    if (!response.ok) throw new Error(`Unable to load ${examId}`)
    return response.json() as Promise<PracticeExam>
  })
  // A failed load should not be remembered - the retry button has to be able to
  // try again.
  request.catch(() => cache.delete(examId))
  cache.set(examId, request)
  return request
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const rest = safe % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(rest)}`
    : `${minutes}:${pad(rest)}`
}
