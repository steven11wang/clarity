import { EXAM_CATALOG } from './examData.ts'
import { scaledScore } from './examScore.ts'
import type { PracticeExamRecord } from '../../storage/index.ts'

/**
 * The reading programme, in order.
 *
 * It follows the sequence The College Panda lays out: learn the words, sit one
 * untimed exam with a dictionary to find out what you could score if vocabulary
 * and the clock were not in the way, then work four exams the slow way -
 * eliminate out loud, mark the key, review every question you were not sure of
 * - and only then put the clock back on.
 */
export type ProgramStep =
  | { kind: 'vocabulary'; id: string; title: string; blurb: string }
  | {
      kind: 'diagnostic' | 'exam'
      id: string
      examId: string
      title: string
      source: string
      blurb: string
    }
  | { kind: 'timed'; id: string; title: string; blurb: string }

export const PROGRAM: ProgramStep[] = [
  {
    kind: 'vocabulary',
    id: 'vocabulary',
    title: 'Learn the words first',
    blurb:
      'A passage you can’t read is a question you can’t answer. Get the high-frequency list down before you spend an exam on it.',
  },
  {
    kind: 'diagnostic',
    id: 'diagnostic',
    examId: 'kaplan-diagnostic',
    title: 'Find your untimed dictionary score',
    source: 'Kaplan',
    blurb:
      'No clock, dictionary on, look up every word you don’t know. This is the score you’d already have if vocabulary and speed weren’t in the way.',
  },
  ...EXAM_CATALOG.slice(1).map((exam, index) => ({
    kind: 'exam' as const,
    id: `exam-${index + 1}`,
    examId: exam.id,
    title: `Untimed exam ${index + 1} of 4`,
    source: exam.source,
    blurb:
      index === 0
        ? 'Same rules as the diagnostic. Read until you can say the main point in a sentence, then cross out choices before you pick one.'
        : 'Keep going the slow way. Cross out first, pick second, and review every question you weren’t sure about.',
  })),
  {
    kind: 'timed',
    id: 'timed',
    title: 'Put the clock back on',
    blurb:
      'Four exams in, run them again at official pace with the dictionary off. The gap between this and your untimed score is vocabulary and speed.',
  },
]

export type ExamProgress = {
  /** Best untimed run, if the exam has been sat untimed at all. */
  untimed: PracticeExamRecord | null
  /** Best run at any fixed clock. */
  timed: PracticeExamRecord | null
  attempts: number
}

export type ProgramProgress = {
  byExam: Record<string, ExamProgress>
  /** Scaled score of the best untimed diagnostic run, or null. */
  uds: number | null
  /** Best timed score across the four practice exams, or null. */
  bestTimed: number | null
  /** Index of the step the student should be on. */
  currentIndex: number
}

/**
 * Scaled score for a record. Exams whose bank ships fewer than a full 54 keyed
 * questions are scaled up to the full section before the curve is applied, so
 * two exams are comparable.
 */
export function recordScore(record: PracticeExamRecord, keyed: Map<string, string>): number | null {
  if (keyed.size === 0) return null
  let wrong = 0
  for (const [questionId, answer] of keyed) {
    if (record.result.answers[questionId] !== answer) wrong += 1
  }
  return scaledScore(Math.round((wrong * 54) / keyed.size))
}

function better(
  a: PracticeExamRecord | null,
  b: PracticeExamRecord,
  score: (record: PracticeExamRecord) => number | null,
): PracticeExamRecord {
  if (!a) return b
  return (score(b) ?? -1) > (score(a) ?? -1) ? b : a
}

export function programProgress(
  records: PracticeExamRecord[],
  score: (record: PracticeExamRecord) => number | null,
): ProgramProgress {
  const byExam: Record<string, ExamProgress> = {}
  for (const exam of EXAM_CATALOG) {
    byExam[exam.id] = { untimed: null, timed: null, attempts: 0 }
  }

  for (const record of records) {
    const entry = byExam[record.examId]
    if (!entry) continue
    entry.attempts += 1
    if (record.result.untimed) entry.untimed = better(entry.untimed, record, score)
    else entry.timed = better(entry.timed, record, score)
  }

  const diagnostic = byExam['kaplan-diagnostic']
  const uds = diagnostic?.untimed ? score(diagnostic.untimed) : null

  const timedScores = EXAM_CATALOG.slice(1)
    .map((exam) => byExam[exam.id]?.timed)
    .filter((record): record is PracticeExamRecord => Boolean(record))
    .map((record) => score(record))
    .filter((value): value is number => value !== null)
  const bestTimed = timedScores.length ? Math.max(...timedScores) : null

  const done = (step: ProgramStep): boolean => {
    if (step.kind === 'vocabulary') return uds !== null
    if (step.kind === 'timed') return bestTimed !== null
    return Boolean(byExam[step.examId]?.untimed)
  }

  const firstOpen = PROGRAM.findIndex((step) => !done(step))
  return {
    byExam,
    uds,
    bestTimed,
    currentIndex: firstOpen === -1 ? PROGRAM.length - 1 : firstOpen,
  }
}

/**
 * What the untimed score means, in the terms the method uses: the gap to 800 is
 * critical thinking, the gap between untimed and timed is vocabulary and speed.
 */
export function readUds(uds: number): { verdict: string; advice: string } {
  if (uds >= 740) {
    return {
      verdict: 'Vocabulary and speed are the whole gap.',
      advice:
        'You already reason well enough for a top score. Keep drilling words and start running sections against the clock — you can skip ahead.',
    }
  }
  if (uds >= 680) {
    return {
      verdict: 'Close, but something in the reasoning is leaking points.',
      advice:
        'Usually it’s second-best answers. Work the four exams slowly and spend the review on questions you got right but weren’t sure about.',
    }
  }
  return {
    verdict: 'Comprehension is the thing to fix first.',
    advice:
      'Take the exams untimed with a dictionary and don’t rush it. One passage can take twenty minutes. That’s fine — it’s the point.',
  }
}
