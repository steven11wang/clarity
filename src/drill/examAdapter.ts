import {
  ALL_SKILLS,
  ANY_DIFFICULTY,
  MIXED_DOMAIN,
  type DrillSetup,
} from './setup.ts'
import { DOMAIN_PRESENTATION, type SatDomain } from '../progression/config.ts'
import { orderedChoices } from '../review/ordering.ts'
import type {
  ExamDifficulty,
  ExamQuestion,
  PracticeExam,
} from '../components/Exam/examData.ts'
import type { Question } from '../types.ts'

// A drill and a practice exam ask the same thing of the student, so they should
// look the same while they're doing it. The exam runner is the full-screen
// surface - passage on the left, question on the right, clock and question list
// in the frame - and it speaks the exam's own question shape. This translates a
// drill set into that shape so one runner serves both.
//
// The reverse trip lives in Exam/reviewQuestion.ts, which carries an exam miss
// back into the bank's Question shape for the vault.

export type DrillExam = {
  exam: PracticeExam
  /**
   * questionId -> the display letter the runner showed -> the letter that
   * choice actually is in the bank. A resurfaced question is shuffled, so the
   * two differ and every answer has to be translated back before it is logged.
   */
  sourceLetters: Record<string, Record<string, string>>
}

/** What the student aimed at, written out for the runner's header. */
export function drillTargetLabel(setup: DrillSetup): string {
  const domain =
    setup.domain === MIXED_DOMAIN
      ? 'Every domain'
      : DOMAIN_PRESENTATION[setup.domain as SatDomain]?.shortName ?? setup.domain
  const skill = setup.skill === ALL_SKILLS ? null : setup.skill
  const difficulty = setup.difficulty === ANY_DIFFICULTY ? null : setup.difficulty
  return [domain, skill, difficulty].filter(Boolean).join(' · ')
}

const EXAM_DIFFICULTIES: ExamDifficulty[] = ['easy', 'medium', 'hard', 'extreme']

function examDifficulty(difficulty: string): ExamDifficulty | null {
  const lowered = difficulty.toLowerCase() as ExamDifficulty
  return EXAM_DIFFICULTIES.includes(lowered) ? lowered : null
}

/**
 * The bank writes one rationale for the whole question; the exam runner's
 * report expects a summary plus a line per choice. Only the summary is honest
 * here, so the per-choice map is left empty rather than invented.
 */
function explanation(question: Question) {
  return { summary: question.rationale, choices: {} as Record<string, string> }
}

function toExamQuestion(
  question: Question,
  isReview: boolean,
  number: number,
): { question: ExamQuestion; sourceLetters: Record<string, string> } {
  const slots = orderedChoices(question, isReview)
  const sourceLetters: Record<string, string> = {}
  for (const slot of slots) sourceLetters[slot.displayLetter] = slot.sourceLetter

  const answerSlot = slots.find((slot) => slot.sourceLetter === question.answer)

  return {
    sourceLetters,
    question: {
      id: question.id,
      number,
      // The bank stores one string; the exam renderer paints a paragraph each.
      passage: question.passage ? question.passage.split('\n\n') : [],
      figure:
        question.has_figure && question.figure_type === 'graph' && question.image
          ? { alt: question.figure_description ?? '', src: question.image }
          : null,
      table:
        question.has_figure && question.figure_type === 'table' && question.table
          ? { caption: null, headers: question.table.headers, rows: question.table.rows }
          : null,
      stem: question.prompt,
      choices: slots.map((slot) => ({ letter: slot.displayLetter, text: slot.text })),
      answer: answerSlot?.displayLetter ?? question.answer,
      topic: question.domain,
      subtopic: question.skill,
      difficulty: examDifficulty(question.difficulty),
      explanation: explanation(question),
    },
  }
}

/**
 * One module, one question list, no clock of its own - a drill's clock is per
 * question and the runner is told about it separately.
 */
export function drillToPracticeExam(
  items: Array<{ question: Question; isReview: boolean }>,
  setup: DrillSetup,
  id = 'drill',
): DrillExam {
  const sourceLetters: Record<string, Record<string, string>> = {}
  const questions = items.map((item, index) => {
    const converted = toExamQuestion(item.question, item.isReview, index + 1)
    sourceLetters[item.question.id] = converted.sourceLetters
    return converted.question
  })

  return {
    sourceLetters,
    exam: {
      id,
      title: 'Drill',
      section: 'Drill',
      subject: drillTargetLabel(setup),
      answerKeySource: 'official',
      assetBase: '',
      modules: [
        {
          id: `${id}:module`,
          number: 1,
          subject: drillTargetLabel(setup),
          label: `${questions.length} ${questions.length === 1 ? 'question' : 'questions'}`,
          // Only used by the module clock, which a drill replaces with its own.
          durationSeconds: (setup.secondsPerQuestion ?? 0) * questions.length,
          questions,
        },
      ],
    },
  }
}

/** Translate a runner answer (a display letter) back into the bank's letter. */
export function toSourceLetter(
  drillExam: DrillExam,
  questionId: string,
  displayLetter: string,
): string {
  if (!displayLetter) return ''
  return drillExam.sourceLetters[questionId]?.[displayLetter] ?? displayLetter
}
