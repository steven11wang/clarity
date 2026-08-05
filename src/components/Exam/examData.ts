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

export type ExamQuestion = {
  id: string
  number: number
  passage: string[]
  figure: ExamFigure | null
  stem: string
  choices: ExamChoice[]
  /** null when the bank ships without a key for this item. */
  answer: string | null
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

const EXAM_DIR = '/data/practice-exams'
const EXAM_PATH = assetPath(`${EXAM_DIR}/cooksat-mock-exam-2.json`)

export function examAssetPath(src: string): string {
  return assetPath(`${EXAM_DIR}/${src}`)
}

export async function loadPracticeExam(): Promise<PracticeExam> {
  const response = await fetch(EXAM_PATH)
  if (!response.ok) throw new Error('Unable to load the practice exam')
  return response.json() as Promise<PracticeExam>
}

export function examQuestionCount(exam: PracticeExam): number {
  return exam.modules.reduce((sum, module) => sum + module.questions.length, 0)
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
