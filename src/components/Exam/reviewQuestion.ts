import type { Question } from '../../types.ts'
import { examAssetSrc, type ExamQuestion, type PracticeExam } from './examData.ts'

// A practice exam ships its own question shape — its own ids, its own choice
// list, its own explanation block. The resurrection queue speaks one language,
// so an exam miss is translated into the bank's Question shape on the way in.
// The translated copy travels with the review item, which is what lets the
// vault and the daily return hand back a question the practice bank has never
// heard of.

const LETTERS = ['A', 'B', 'C', 'D'] as const
type Letter = (typeof LETTERS)[number]

function isLetter(value: string | null | undefined): value is Letter {
  return LETTERS.includes(value as Letter)
}

// Exam question ids are only unique inside their exam, so the queue key is
// namespaced. It also makes the origin readable in a backup file.
export function examReviewId(examId: string, questionId: string): string {
  return `exam:${examId}:${questionId}`
}

// Why the key works, plus why each distractor fails — the closest thing an exam
// has to the bank's rationale. Falls back to a plain statement of the answer
// when the bank shipped without written explanations.
function rationale(question: ExamQuestion): string {
  const explanation = question.explanation
  if (!explanation) {
    return question.answer
      ? `The correct answer is ${question.answer}.`
      : 'This question shipped without a written explanation.'
  }
  const perChoice = LETTERS.filter((letter) => explanation.choices?.[letter])
    .map((letter) => `${letter}: ${explanation.choices[letter]}`)
    .join('\n')
  return [explanation.summary, perChoice].filter(Boolean).join('\n\n')
}

// Returns null for anything the queue could not hand back honestly: a question
// with no answer key, or one whose choices are not the usual four letters.
export function examQuestionToReviewQuestion(
  exam: PracticeExam,
  question: ExamQuestion,
): Question | null {
  if (!isLetter(question.answer)) return null

  const choices = {} as Record<Letter, string>
  for (const choice of question.choices) {
    if (isLetter(choice.letter)) choices[choice.letter] = choice.text
  }
  if (LETTERS.some((letter) => choices[letter] === undefined)) return null

  return {
    id: examReviewId(exam.id, question.id),
    assessment: 'SAT',
    test: exam.title,
    domain: question.topic ?? 'Untagged',
    skill: question.subtopic ?? 'Untagged',
    difficulty: question.difficulty ?? 'unknown',
    passage: question.passage.join('\n\n'),
    prompt: question.stem,
    choices,
    answer: question.answer,
    rationale: rationale(question),
    // A question hangs off a table or a figure, never both — the same order the
    // passage renderer reads them in.
    ...(question.table
      ? {
          has_figure: true as const,
          figure_type: 'table' as const,
          table: {
            headers: question.table.headers,
            rows: question.table.rows,
          },
        }
      : question.figure
        ? {
            has_figure: true as const,
            figure_type: 'graph' as const,
            image: examAssetSrc(question.figure.src),
            figure_description: question.figure.alt,
          }
        : {}),
  }
}
