// Practice exams for the redesign: the live app's five full Reading and Writing
// tests, sat module by module, saved as you go, scored on the live app's
// curve, and every miss clipped into the Mistake Notebook like any other.

import { useSyncExternalStore } from 'react'

import { EXAM_CATALOG, loadPracticeExam, type ExamQuestion, type PracticeExam } from '../../components/Exam/examData.ts'
import { scaledScore } from '../../components/Exam/examScore.ts'
import type { Question } from '../../types.ts'

export { EXAM_CATALOG, loadPracticeExam, scaledScore }
export type { PracticeExam, ExamQuestion }

export type ExamPace = 'test-day' | 'relaxed' | 'untimed'

export const PACES: Array<{ id: ExamPace; label: string; note: string; factor: number | null }> = [
  { id: 'test-day', label: 'Test day', note: '32 minutes a module, like the real thing', factor: 1 },
  { id: 'relaxed', label: 'Extra time', note: '48 minutes a module (1.5×)', factor: 1.5 },
  { id: 'untimed', label: 'Untimed', note: 'No clock. Find the score you could get', factor: null },
]

/** Booklet covers, in catalogue order: one ink each, so a test is recognisable at a glance. */
export const EXAM_INKS = ['var(--violet)', 'var(--pink)', 'var(--blue)', 'var(--green)', 'var(--orange)']

export type Sitting = {
  examId: string
  pace: ExamPace
  module: number // 0-based
  index: number
  answers: Record<string, string>
  marked: string[]
  secondsLeft: number | null // for the current module
  startedAt: number
}

export type ExamResult = {
  examId: string
  pace: ExamPace
  finishedAt: number
  correct: number
  total: number
  scaled: number
  byDomain: Array<{ name: string; correct: number; total: number }>
  wrong: string[] // exam question ids
  secondsUsed: number
}

type ExamState = { sitting: Sitting | null; results: ExamResult[] }

const KEY = 'clarity-redesign:exams'
const QUESTIONS_KEY = 'clarity-redesign:exam-questions'

function read(): ExamState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as ExamState | null
    if (raw && Array.isArray(raw.results)) return raw
  } catch {
    /* start clean */
  }
  return { sitting: null, results: [] }
}

let state = read()
const listeners = new Set<() => void>()

function write(next: ExamState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* keeps working for this visit */
  }
  listeners.forEach((listener) => listener())
}

export function useExams(): ExamState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

export function getExams(): ExamState {
  return state
}

export function saveSitting(sitting: Sitting | null) {
  write({ ...state, sitting })
}

export function recordResult(result: ExamResult) {
  write({ sitting: null, results: [...state.results, result] })
}

export function moduleSeconds(durationSeconds: number, pace: ExamPace): number | null {
  const factor = PACES.find((item) => item.id === pace)?.factor
  if (factor === null) return null // untimed: no clock at all
  return Math.round(durationSeconds * (factor ?? 1))
}

export function bestResult(examId?: string): ExamResult | null {
  const pool = examId ? state.results.filter((result) => result.examId === examId) : state.results
  return pool.reduce<ExamResult | null>((best, result) => (!best || result.scaled > best.scaled ? result : best), null)
}

export function examTitle(examId: string): string {
  return EXAM_CATALOG.find((exam) => exam.id === examId)?.title ?? 'Practice test'
}

// ---------------------------------------------------------------------------
// Exam questions → Mistake Notebook questions

const DIFFICULTY: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', extreme: 'Hard' }

export function examQid(examId: string, questionId: string) {
  return `exam:${examId}:${questionId}`
}

export function toQuestion(exam: PracticeExam, question: ExamQuestion): Question {
  const choices = { A: '', B: '', C: '', D: '' } as Question['choices']
  question.choices.forEach((choice) => {
    if (choice.letter in choices) choices[choice.letter as keyof typeof choices] = choice.text
  })
  const why = question.explanation
  const rationale = why
    ? [why.summary, ...Object.entries(why.choices).map(([letter, text]) => `Choice ${letter}: ${text}`)].join(' ')
    : `The answer is ${question.answer}.`
  return {
    id: examQid(exam.id, question.id),
    assessment: 'SAT',
    test: 'Reading and Writing',
    domain: question.topic ?? 'Reading and Writing',
    skill: question.subtopic ?? 'Words in Context',
    difficulty: DIFFICULTY[question.difficulty ?? 'medium'] ?? 'Medium',
    passage: question.passage.join('\n\n'),
    prompt: question.stem,
    choices,
    answer: (question.answer ?? 'A') as Question['answer'],
    rationale,
  }
}

/** Questions from exams, kept so a missed one can come back as a comeback. */
export function rememberExamQuestions(questions: Question[]) {
  try {
    const saved = JSON.parse(localStorage.getItem(QUESTIONS_KEY) ?? '{}') as Record<string, Question>
    questions.forEach((question) => (saved[question.id] = question))
    localStorage.setItem(QUESTIONS_KEY, JSON.stringify(saved))
  } catch {
    /* without storage the miss still counts, it just can't come back */
  }
}

export function examQuestionById(id: string): Question | undefined {
  if (!id.startsWith('exam:')) return undefined
  try {
    const saved = JSON.parse(localStorage.getItem(QUESTIONS_KEY) ?? '{}') as Record<string, Question>
    return saved[id]
  } catch {
    return undefined
  }
}
