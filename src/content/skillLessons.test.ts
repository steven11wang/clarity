import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  GENERAL_TIPS_STEP_KEY,
  LESSON_PAGES_PATH,
  SKILL_LESSON_INDEX,
  buildLessonSteps,
  getSkillLessonSummary,
  hasSkillLesson,
  lessonExamples,
  loadSkillLesson,
  type LessonBlock,
  type SkillLesson,
} from './skillLessons.ts'
import { SAT_DOMAINS } from '../progression/config.ts'
import type { Question } from '../types.ts'

// The pages ship as a static asset the browser fetches. Serve the real file
// from disk so these tests exercise the same parsing path the app does.
const pagesPath = new URL('../../public/lessons/skill-lessons.json', import.meta.url)
const pagesBody = readFileSync(pagesPath, 'utf8')

globalThis.fetch = (async (input: RequestInfo | URL) => {
  assert.equal(String(input), LESSON_PAGES_PATH)
  return {
    ok: true,
    json: async () => JSON.parse(pagesBody) as unknown,
  } as Response
}) as typeof fetch

// public/data is gitignored (the bank is generated), so a fresh clone may not
// have it. Skip bank-coverage assertions rather than fail spuriously.
const bankPath = new URL('../../public/data/questions.json', import.meta.url)
const bankSkills: string[] | null = existsSync(bankPath)
  ? [
      ...new Set(
        (JSON.parse(readFileSync(bankPath, 'utf8')) as Question[]).map(
          (question) => question.skill,
        ),
      ),
    ].sort()
  : null

const lessons: SkillLesson[] = await Promise.all(
  SKILL_LESSON_INDEX.map(async (summary) => {
    const lesson = await loadSkillLesson(summary.skill)
    assert.ok(lesson, `no pages for ${summary.skill}`)
    return lesson
  }),
)

function everyBlock(): LessonBlock[] {
  return lessons.flatMap((lesson) =>
    lesson.parts.flatMap((part) => part.pages.flatMap((page) => page.blocks)),
  )
}

describe('skill lessons', () => {
  it('covers every skill present in the question bank', (t) => {
    if (bankSkills === null) return t.skip('question bank not generated')
    const missing = bankSkills.filter((skill) => !hasSkillLesson(skill))
    assert.deepEqual(missing, [], `skills without a lesson: ${missing.join(', ')}`)
  })

  it('does not carry lessons for skills the bank never serves', (t) => {
    if (bankSkills === null) return t.skip('question bank not generated')
    const orphans = SKILL_LESSON_INDEX.map((summary) => summary.skill).filter(
      (skill) => !bankSkills.includes(skill),
    )
    assert.deepEqual(orphans, [])
  })

  it('files every lesson under a real SAT domain', () => {
    SKILL_LESSON_INDEX.forEach((summary) => {
      assert.ok(
        (SAT_DOMAINS as readonly string[]).includes(summary.domain),
        `${summary.skill} has unknown domain ${summary.domain}`,
      )
    })
  })

  it('gives every lesson framing copy and at least one page', () => {
    lessons.forEach((lesson) => {
      assert.ok(lesson.nutshell.length > 20, `${lesson.skill} nutshell too short`)
      assert.ok(lesson.oneMove.length > 20, `${lesson.skill} oneMove too short`)
      assert.ok(lesson.watchOut.length >= 2, `${lesson.skill} needs 2+ watch-outs`)
      assert.ok(lesson.parts.length >= 1)
      lesson.parts.forEach((part) => {
        assert.ok(part.pages.length >= 1, `${lesson.skill} / ${part.title} has no pages`)
        part.pages.forEach((page) => {
          assert.ok(page.title.length > 0)
          assert.ok(page.blocks.length > 0, `${lesson.skill} / ${page.title} is empty`)
        })
      })
    })
  })

  it('keeps the bundled index in sync with the lazily loaded pages', () => {
    // The cover renders from the index before the pages arrive, so a drift here
    // would show the student a step count or part list that then changes.
    lessons.forEach((lesson) => {
      const summary = getSkillLessonSummary(lesson.skill)
      assert.ok(summary)
      assert.equal(summary.stepCount, buildLessonSteps(lesson).length)
      assert.deepEqual(
        summary.partTitles,
        lesson.parts.map((part) => part.title),
      )
    })
  })

  it('teaches Command of Evidence as two parts', () => {
    // The bank treats textual and quantitative evidence as one skill, but the
    // quantitative half comes with a figure and is approached differently.
    const lesson = lessons.find((entry) => entry.skill === 'Command of Evidence')
    assert.ok(lesson)
    assert.equal(lesson.parts.length, 2)
    assert.match(lesson.parts[0].title, /Textual/)
    assert.match(lesson.parts[1].title, /Quantitative/)
  })

  it('keeps every worked example answerable and explained', () => {
    everyBlock().forEach((block) => {
      if (block.type !== 'example') return
      assert.ok(['A', 'B', 'C', 'D'].includes(block.answer), `bad answer ${block.answer}`)
      assert.ok(
        block.choices[block.answer],
        `answer ${block.answer} has no matching choice: ${block.prompt}`,
      )
      assert.equal(
        Object.keys(block.choices).length,
        4,
        `expected 4 choices for: ${block.prompt}`,
      )
      Object.entries(block.choices).forEach(([letter, text]) => {
        assert.ok(text.trim().length > 0, `empty choice ${letter}: ${block.prompt}`)
      })
      assert.ok(block.prompt.trim().length > 0)
      assert.ok(
        block.explanation.length > 0,
        `example has no explanation: ${block.prompt}`,
      )
      assert.ok(
        block.passage.length > 0 || Boolean(block.table) || Boolean(block.notes?.length),
        `example has no stimulus: ${block.prompt}`,
      )
    })
  })

  it('gives every skill at least one example to attempt', () => {
    lessons.forEach((lesson) => {
      assert.ok(
        lessonExamples(lesson).length >= 1,
        `${lesson.skill} has no worked example`,
      )
    })
  })

  it('shows real prompts on the cover so the stem looks familiar', () => {
    SKILL_LESSON_INDEX.forEach((summary) => {
      assert.ok(summary.promptSamples.length >= 1, `${summary.skill} has no prompt samples`)
      assert.ok(summary.promptSamples.length <= 4)
      assert.equal(
        new Set(summary.promptSamples).size,
        summary.promptSamples.length,
        `${summary.skill} repeats a prompt sample`,
      )
    })
  })

  it('closes every lesson with the shared general tips exactly once', () => {
    lessons.forEach((lesson) => {
      assert.ok(lesson.generalTips.length > 0)
      const steps = buildLessonSteps(lesson)
      const tipSteps = steps.filter((step) => step.key === GENERAL_TIPS_STEP_KEY)
      assert.equal(tipSteps.length, 1, `${lesson.skill} general tips count`)
      assert.equal(steps.at(-1)?.key, GENERAL_TIPS_STEP_KEY)
    })
  })

  it('labels part boundaries only on multi-part lessons', () => {
    lessons.forEach((lesson) => {
      const steps = buildLessonSteps(lesson)
      const partStarts = steps.filter((step) => step.startsPart)
      assert.equal(
        partStarts.length,
        lesson.parts.length > 1 ? lesson.parts.length : 0,
        `${lesson.skill} part banners`,
      )
    })
  })

  it('builds stable, unique step keys', () => {
    lessons.forEach((lesson) => {
      const keys = buildLessonSteps(lesson).map((step) => step.key)
      assert.equal(new Set(keys).size, keys.length, `${lesson.skill} has duplicate step keys`)
    })
  })

  it('returns null for a skill with no lesson', async () => {
    assert.equal(getSkillLessonSummary('Not A Skill'), null)
    assert.equal(await loadSkillLesson('Not A Skill'), null)
  })
})
