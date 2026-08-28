import type { Question } from '../types.ts'
import type { LessonExample } from './skillLessons.ts'

// A worked example is written into a lesson page, not pulled from the question
// bank, so it has no id of its own. Missing one is still a miss: it is given a
// stable id from where it sits in the lesson and translated into the bank's
// Question shape, so the vault and the daily return can hand it back.

// `key` is the example's position in the lesson — part, page, block index —
// which the lesson builder already assigns and keeps stable across rebuilds.
export function lessonExampleId(skill: string, key: string): string {
  return `lesson:${skill}:${key}`
}

// A lesson figure is a written description rather than an image, so the queue
// keeps it as a line of the passage. Dropping it would leave a question the
// student cannot answer.
function passageOf(example: LessonExample): string {
  const lines = example.figure
    ? [...example.passage, `[Figure] ${example.figure}`]
    : example.passage
  return lines.join('\n\n')
}

export function lessonExampleToReviewQuestion({
  example,
  skill,
  domain,
  key,
}: {
  example: LessonExample
  skill: string
  domain: string
  key: string
}): Question {
  return {
    id: lessonExampleId(skill, key),
    assessment: 'SAT',
    test: 'Lesson',
    domain,
    skill,
    difficulty: 'lesson',
    passage: passageOf(example),
    ...(example.notes ? { notes: example.notes } : {}),
    prompt: example.prompt,
    choices: example.choices,
    answer: example.answer,
    rationale: example.explanation.map((block) => block.text).join('\n\n'),
    ...(example.table
      ? {
          has_figure: true as const,
          figure_type: 'table' as const,
          table: {
            headers: example.table[0] ?? [],
            rows: example.table.slice(1),
          },
        }
      : {}),
  }
}
