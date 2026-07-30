import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { buildLessonTabs, type BriefItem, type BriefSection } from './lessonBrief.ts'
import {
  LESSON_PAGES_PATH,
  SKILL_LESSON_INDEX,
  loadSkillLesson,
  type SkillLesson,
} from './skillLessons.ts'

const pagesPath = new URL('../../public/lessons/skill-lessons.json', import.meta.url)
const pagesBody = readFileSync(pagesPath, 'utf8')

globalThis.fetch = (async (input: RequestInfo | URL) => {
  assert.equal(String(input), LESSON_PAGES_PATH)
  return { ok: true, json: async () => JSON.parse(pagesBody) as unknown } as Response
}) as typeof fetch

const lessons: SkillLesson[] = await Promise.all(
  SKILL_LESSON_INDEX.map(async (summary) => {
    const lesson = await loadSkillLesson(summary.skill)
    assert.ok(lesson, `no pages for ${summary.skill}`)
    return lesson
  }),
)

function textOf(items: BriefItem[]): string[] {
  return items.flatMap((item) =>
    item.kind === 'p' ? [item.text] : [...(item.intro ? [item.intro] : []), ...item.items],
  )
}

function paragraphsOf(items: BriefItem[]): string[] {
  return items.filter((item) => item.kind === 'p').map((item) => item.text)
}

function allSections(skill: SkillLesson): BriefSection[] {
  const tabs = buildLessonTabs(skill)
  return tabs.briefs.flatMap((block) => [block.brief.asks, ...block.brief.think])
}

describe('lesson brief', () => {
  it('gives every skill an opener, a way to think, and a method', () => {
    lessons.forEach((lesson) => {
      const tabs = buildLessonTabs(lesson)
      assert.ok(tabs.briefs.length >= 1, `${lesson.skill} has no brief`)
      tabs.briefs.forEach(({ partTitle, brief }) => {
        const where = `${lesson.skill}${partTitle ? ` / ${partTitle}` : ''}`
        assert.ok(brief.asks.keep.length > 0, `${where} has no opener`)
        assert.ok(brief.method.length >= 2, `${where} has fewer than two steps`)
      })
    })
  })

  it('numbers method steps from one, in order, with a detail each', () => {
    lessons.forEach((lesson) => {
      buildLessonTabs(lesson).briefs.forEach(({ partTitle, brief }) => {
        const where = `${lesson.skill}${partTitle ? ` / ${partTitle}` : ''}`
        brief.method.forEach((step, index) => {
          assert.equal(step.n, index + 1, `${where} step ${index + 1} is numbered ${step.n}`)
          assert.ok(step.title.length > 0, `${where} step ${step.n} has no title`)
          assert.ok(step.body.length > 0, `${where} step ${step.n} has no body`)
        })
      })
    })
  })

  it('keeps the opener to two paragraphs — the whole point of the trim', () => {
    lessons.forEach((lesson) => {
      buildLessonTabs(lesson).briefs.forEach(({ brief }) => {
        assert.ok(
          paragraphsOf(brief.asks.keep).length <= 2,
          `${lesson.skill} opener kept ${paragraphsOf(brief.asks.keep).length} paragraphs`,
        )
      })
    })
  })

  it('shows at most one paragraph per idea, with the rest still reachable', () => {
    lessons.forEach((lesson) => {
      buildLessonTabs(lesson).briefs.forEach(({ brief }) => {
        brief.think.forEach((section) => {
          assert.ok(
            paragraphsOf(section.keep).length <= 1,
            `${lesson.skill} / ${section.heading ?? 'lead'} kept too much`,
          )
        })
      })
    })
  })

  it('never promotes a bare list item as if it were a paragraph', () => {
    // A colon lead-in owns the bullets under it; promoting "an introduction"
    // on its own reads as a fragment.
    lessons.forEach((lesson) => {
      allSections(lesson).forEach((section) => {
        paragraphsOf(section.keep).forEach((text) => {
          assert.ok(
            text.length > 25,
            `${lesson.skill} promoted a fragment: "${text}"`,
          )
        })
      })
    })
  })

  it('loses no source text — everything is either kept or disclosed', () => {
    lessons.forEach((lesson) => {
      const tabs = buildLessonTabs(lesson)
      const surfaced = new Set(
        tabs.briefs.flatMap(({ brief }) => [
          ...textOf(brief.asks.keep),
          ...brief.asks.extra,
          ...brief.think.flatMap((section) => [...textOf(section.keep), ...section.extra]),
          ...brief.methodExtra,
          ...brief.method.flatMap((step) => [...textOf(step.body), ...step.extra]),
        ]),
      )
      // Step headings are rewritten into titles, so check bodies only.
      const missing = lesson.parts
        .flatMap((part) => part.pages)
        .filter((page) => /^(what are|how should we|how to approach|which standard)/i.test(page.title))
        .flatMap((page) => page.blocks)
        .filter((block) => block.type === 'p' || block.type === 'li')
        .map((block) => (block as { text: string }).text.trim())
        .filter((text) => text.length > 60 && !surfaced.has(text) && !/^step\s*\d/i.test(text))
      assert.deepEqual(missing, [], `${lesson.skill} dropped source text`)
    })
  })

  it('routes every worked example onto the example tab', () => {
    lessons.forEach((lesson) => {
      const tabs = buildLessonTabs(lesson)
      const inSource = lesson.parts
        .flatMap((part) => part.pages)
        .flatMap((page) => page.blocks)
        .filter((block) => block.type === 'example').length
      assert.equal(tabs.examples.length, inSource, `${lesson.skill} example count`)
      assert.ok(tabs.examples.length >= 1, `${lesson.skill} has no example`)
      assert.equal(
        new Set(tabs.examples.map((entry) => entry.key)).size,
        tabs.examples.length,
        `${lesson.skill} has duplicate example keys`,
      )
    })
  })

  it('carries the shared general tips onto every skill', () => {
    lessons.forEach((lesson) => {
      assert.ok(
        buildLessonTabs(lesson).generalTips.length > 0,
        `${lesson.skill} lost the general tips`,
      )
    })
  })

  it('splits Command of Evidence into its two parts and nothing else', () => {
    const lesson = lessons.find((entry) => entry.skill === 'Command of Evidence')
    assert.ok(lesson)
    const tabs = buildLessonTabs(lesson)
    assert.equal(tabs.briefs.length, 2)
    assert.match(String(tabs.briefs[0].partTitle), /Textual/)
    assert.match(String(tabs.briefs[1].partTitle), /Quantitative/)
  })

  it('gives the part-to-whole deep dive its own brief', () => {
    // One part, two topics: the article restarts with "What are …", so the
    // deep dive must not be folded into the main topic's "how to think".
    const lesson = lessons.find((entry) => entry.skill === 'Text Structure and Purpose')
    assert.ok(lesson)
    const tabs = buildLessonTabs(lesson)
    assert.equal(tabs.briefs.length, 2)
    assert.match(String(tabs.briefs[1].partTitle), /Part-to-Whole/i)
  })

  it('labels no part on a single-topic lesson', () => {
    const lesson = lessons.find((entry) => entry.skill === 'Inferences')
    assert.ok(lesson)
    const tabs = buildLessonTabs(lesson)
    assert.equal(tabs.briefs.length, 1)
    assert.equal(tabs.briefs[0].partTitle, null)
  })
})
