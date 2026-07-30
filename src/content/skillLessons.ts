// Foundations lessons for every SAT Reading & Writing skill in the question
// bank. The content is generated from the source Khan Academy article set by
// tools/build_lessons.py — edit that script (or its authored-page table) and
// regenerate rather than hand-editing the JSON.
//
// Shape: a lesson has one or more parts, a part has pages, a page has blocks.
// Command of Evidence is the only two-part lesson: the bank treats textual and
// quantitative evidence as one skill, but they are approached differently, so
// the student walks the textual article and then the quantitative one.
//
// Two files, on purpose:
//   src/content/skillLessonIndex.json  ~3 KB gzip — bundled. Enough to render
//                          the skill path and the whole lesson cover instantly.
//   public/lessons/skill-lessons.json  ~44 KB gzip — a static asset fetched
//                          when a lesson opens, so it never lands in the
//                          initial bundle. The student reads the cover while
//                          it loads. Fetched rather than dynamically imported
//                          because Vite preserves the `with { type: 'json' }`
//                          attribute on a dynamic import while still serving
//                          the file as a JS module, which the browser rejects.

import indexRaw from './skillLessonIndex.json' with { type: 'json' }

export type LessonTable = string[][]

export type LessonExample = {
  type: 'example'
  label?: string
  figure?: string
  table?: LessonTable
  notes?: string[]
  passage: string[]
  prompt: string
  choices: Record<'A' | 'B' | 'C' | 'D', string>
  answer: 'A' | 'B' | 'C' | 'D'
  explanation: LessonProse[]
}

export type LessonCallout = {
  type: 'callout'
  label?: string
  figure?: string
  table?: LessonTable
  notes?: string[]
  lines: string[]
}

export type LessonProse = {
  // lead  — an emphasized opener or a named tip ("Be strict!", "Step 1: …")
  // p     — body copy
  // li    — a bullet; consecutive bullets render as one list
  // h4    — a sub-heading inside a page
  type: 'lead' | 'p' | 'li' | 'h4'
  text: string
}

export type LessonBlock = LessonProse | LessonCallout | LessonExample

export type LessonPage = {
  id: string
  kicker: string
  title: string
  blocks: LessonBlock[]
}

export type LessonPart = {
  id: string
  title: string
  subtitle?: string
  pages: LessonPage[]
}

/** The always-bundled half: everything the cover and the skill path need. */
export type SkillLessonSummary = {
  skill: string
  domain: string
  unit: string | null
  /** One sentence: what this question type actually asks you to do. */
  nutshell: string
  /** The single highest-leverage habit for this skill. */
  oneMove: string
  /** The mistakes that cost the most points here. */
  watchOut: string[]
  /** Real prompts pulled from the worked examples, so the stem looks familiar. */
  promptSamples: string[]
  partTitles: string[]
  /** Steps after the cover, including the closing general-tips step. */
  stepCount: number
}

export const SKILL_LESSON_INDEX = indexRaw as unknown as SkillLessonSummary[]

const BY_SKILL = new Map(
  SKILL_LESSON_INDEX.map((summary) => [summary.skill, summary]),
)

export function getSkillLessonSummary(skill: string): SkillLessonSummary | null {
  return BY_SKILL.get(skill) ?? null
}

export function hasSkillLesson(skill: string): boolean {
  return BY_SKILL.has(skill)
}

// --- Lazily loaded pages ----------------------------------------------------

type LessonPagesFile = {
  generalTips: LessonBlock[]
  parts: Record<string, LessonPart[]>
}

export const LESSON_PAGES_PATH = '/lessons/skill-lessons.json'

let pagesPromise: Promise<LessonPagesFile> | null = null

/**
 * Fetch (once) the heavy article text. Safe to call eagerly — repeated calls
 * share one promise. A failed fetch clears the cache so a later attempt can
 * retry instead of replaying the rejection forever.
 */
export function loadLessonPages(): Promise<LessonPagesFile> {
  if (pagesPromise === null) {
    pagesPromise = fetch(LESSON_PAGES_PATH)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load lessons')
        return response.json() as Promise<LessonPagesFile>
      })
      .catch((error) => {
        pagesPromise = null
        throw error
      })
  }
  return pagesPromise
}

export type SkillLesson = SkillLessonSummary & {
  parts: LessonPart[]
  generalTips: LessonBlock[]
}

export async function loadSkillLesson(skill: string): Promise<SkillLesson | null> {
  const summary = getSkillLessonSummary(skill)
  if (summary === null) return null
  const pages = await loadLessonPages()
  const parts = pages.parts[skill]
  if (!parts) return null
  return { ...summary, parts, generalTips: pages.generalTips }
}

// --- Pager ------------------------------------------------------------------

export type LessonStep = {
  key: string
  kicker: string
  title: string
  blocks: LessonBlock[]
  partTitle: string | null
  partSubtitle: string | null
  /** True on the first step of a part, when the lesson has more than one. */
  startsPart: boolean
}

export const GENERAL_TIPS_STEP_KEY = 'general-tips'

/**
 * Flatten a lesson into the ordered step list the pager walks: every page of
 * every part, plus a closing general-tips step. The part label rides along so
 * the pager can show "Part 2 · Quantitative evidence" on the right steps.
 */
export function buildLessonSteps(lesson: SkillLesson): LessonStep[] {
  const multipart = lesson.parts.length > 1
  const steps: LessonStep[] = []

  lesson.parts.forEach((part) => {
    part.pages.forEach((page, pageIndex) => {
      steps.push({
        key: `${part.id}:${page.id}`,
        kicker: page.kicker,
        title: page.title,
        blocks: page.blocks,
        partTitle: multipart ? part.title : null,
        partSubtitle: multipart ? part.subtitle ?? null : null,
        startsPart: multipart && pageIndex === 0,
      })
    })
  })

  steps.push({
    key: GENERAL_TIPS_STEP_KEY,
    kicker: 'Top tips',
    title: 'Tips that work on every question',
    blocks: lesson.generalTips,
    partTitle: null,
    partSubtitle: null,
    startsPart: false,
  })

  return steps
}

/** Every interactive example in a lesson, in reading order. */
export function lessonExamples(lesson: SkillLesson): LessonExample[] {
  return lesson.parts.flatMap((part) =>
    part.pages.flatMap((page) =>
      page.blocks.filter((block): block is LessonExample => block.type === 'example'),
    ),
  )
}
