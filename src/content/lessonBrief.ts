// Turns a generated lesson into the four things a tabbed lesson page needs:
// a short brief, the worked examples, the tips, and nothing else.
//
// Why derive rather than author: the lesson JSON is generated from the source
// articles by tools/build_lessons.py, and those articles are long — a single
// "how should we think about this" page can run fourteen paragraphs. Reading
// fourteen paragraphs before your first question is how students bounce. So we
// keep the paragraph that *defines* each idea and push the rest — worked-through
// instances, restatements, asides — behind a disclosure. Nothing is deleted; it
// is ranked, and kept in document order so the surviving text still reads as
// prose rather than as highlights.
//
// The rules below are structural, not per-skill, so a regenerated lesson picks
// up the same treatment without anyone editing a table by hand.

import type {
  LessonBlock,
  LessonExample,
  LessonPage,
  LessonPart,
  LessonProse,
  SkillLesson,
} from './skillLessons.ts'

// --- Block predicates -------------------------------------------------------

const STEP = /^step\s*(\d+)\s*[:.—-]\s*(.+)$/i
/** "A guide to X questions on the digital SAT" — article furniture. */
const ARTICLE_BOILERPLATE = /^a guide to /i
/** A sentence whose only job is to point at something we moved elsewhere. */
const POINTER = /(look like this|like the following|these steps|example below|following steps)\s*[:.]?\s*$/i
/** Worked-through instances and cross-sells: not first-read material. */
const ASIDE =
  /^(for instance|for example|this task should remind|consider that|as an example|here'?s one way|to learn more)/i
/** A colon-terminated line introduces a list; on its own it says nothing. */
const LEAD_IN = /:\s*$/
/**
 * "Linking clauses — You may be asked to…". The source articles write some
 * lists as paragraphs with a short bolded term and an em dash. Treated as a
 * bullet so the three of them render as one list instead of three paragraphs.
 */
const TERM_DASH = /^.{1,44}\s+—\s+\S/
/** The source articles restart with "What are X questions?" for each sub-topic. */
const TOPIC_START = /^what are /i
/** Pages that exist to make you answer something. */
const EXAMPLE_TITLE = /^(your turn|try it|try one|watch the three steps)/i
const TIP_TITLE = /^top tip/i

function isProse(block: LessonBlock): block is LessonProse {
  return block.type === 'lead' || block.type === 'p' || block.type === 'li' || block.type === 'h4'
}

/**
 * A short line with no terminal punctuation, used as a heading in the source
 * articles even though the generator typed it as a paragraph.
 *
 * `allowBang` is for the tips pages, where every tip is titled as a shout —
 * "Be strict!", "Stay specific!" — and would otherwise read as body text.
 */
function isHeading(block: LessonBlock, allowBang = false): boolean {
  if (!isProse(block) || block.type === 'li') return false
  const text = block.text.trim()
  if (text.length === 0 || text.length > 72) return false
  return allowBang ? !/[.?:;,]$/.test(text) : !/[.?!:;,]$/.test(text)
}

function isBullet(block: LessonProse): boolean {
  return block.type === 'li' || TERM_DASH.test(block.text.trim())
}

// --- Shapes the tabs render -------------------------------------------------

export type BriefItem =
  | { kind: 'p'; text: string }
  | { kind: 'list'; intro: string | null; items: string[] }

export type BriefSection = {
  heading: string | null
  /** Shown immediately, in document order. */
  keep: BriefItem[]
  /** Shown only if the student opens the long version. */
  extra: string[]
}

export type BriefStep = {
  n: number
  title: string
  body: BriefItem[]
  extra: string[]
}

export type LessonBrief = {
  /** "What these questions ask" — two paragraphs at most. */
  asks: BriefSection
  /** "How to think about them" — one paragraph per named idea. */
  think: BriefSection[]
  /** "The N-step method" — the spine of the lesson. */
  method: BriefStep[]
  /** Whatever the method page said before step 1. Disclosure only. */
  methodExtra: string[]
  /** True when anything was pushed behind the disclosure. */
  hasMore: boolean
}

export type LessonBriefBlock = {
  /** Null for a single-topic lesson; otherwise the part or deep-dive label. */
  partTitle: string | null
  partSubtitle: string | null
  brief: LessonBrief
}

export type LessonTabs = {
  /** One brief per topic. Command of Evidence has two; most skills have one. */
  briefs: LessonBriefBlock[]
  /** Every example in the lesson, in reading order. */
  examples: {
    key: string
    pageTitle: string
    partTitle: string | null
    example: LessonExample
  }[]
  /** Skill-specific tips, as cards. */
  tips: BriefSection[]
  /** Cross-skill tips, collapsed under the skill-specific ones. */
  generalTips: BriefSection[]
}

// --- Units ------------------------------------------------------------------
//
// A "unit" is one renderable thought: a paragraph, or a list with the sentence
// that introduces it. Ranking happens over units so a list never gets separated
// from its lead-in, and so a bare list item never gets promoted on its own.

type Unit =
  | { kind: 'p'; text: string; strong: boolean }
  | { kind: 'list'; intro: string | null; items: string[] }

function toUnits(blocks: LessonBlock[]): Unit[] {
  const units: Unit[] = []

  for (const block of blocks) {
    if (!isProse(block)) continue
    const text = block.text.trim()
    if (text.length === 0) continue
    if (ARTICLE_BOILERPLATE.test(text) || POINTER.test(text)) continue

    if (isBullet(block)) {
      const previous = units[units.length - 1]
      if (previous?.kind === 'list') {
        previous.items.push(text)
        continue
      }
      // A colon-terminated paragraph right before a bullet owns that bullet.
      if (previous?.kind === 'p' && LEAD_IN.test(previous.text)) {
        units[units.length - 1] = { kind: 'list', intro: previous.text, items: [text] }
        continue
      }
      units.push({ kind: 'list', intro: null, items: [text] })
      continue
    }

    units.push({
      kind: 'p',
      text,
      strong: !ASIDE.test(text) && !LEAD_IN.test(text),
    })
  }

  return units
}

/**
 * Keep the first `keepCount` defining paragraphs plus every list, in document
 * order. Everything else becomes disclosure text.
 */
function rank(units: Unit[], keepCount: number): { keep: BriefItem[]; extra: string[] } {
  const strongIndexes = units
    .map((unit, index) => (unit.kind === 'p' && unit.strong ? index : -1))
    .filter((index) => index >= 0)
  let promoted = new Set(strongIndexes.slice(0, keepCount))
  // Nothing qualified and no list to carry the section — a section of pure
  // caveats still needs an opening line, so promote the first paragraph.
  if (promoted.size === 0 && !units.some((unit) => unit.kind === 'list')) {
    const firstParagraph = units.findIndex((unit) => unit.kind === 'p')
    if (firstParagraph >= 0) promoted = new Set([firstParagraph])
  }

  const keep: BriefItem[] = []
  const extra: string[] = []

  units.forEach((unit, index) => {
    if (unit.kind === 'list') {
      keep.push({ kind: 'list', intro: unit.intro, items: unit.items })
    } else if (promoted.has(index)) {
      keep.push({ kind: 'p', text: unit.text })
    } else {
      extra.push(unit.text)
    }
  })

  return { keep, extra }
}

// --- Grouping ---------------------------------------------------------------

type PageRole = 'example' | 'tips' | 'core'

function roleOf(page: LessonPage): PageRole {
  // "Try it!" pages are filed under the Top tips kicker in the source articles
  // even though they are nothing but examples, so the title wins over the
  // kicker — otherwise their "click show explanation" preamble lands on the
  // Tips tab, pointing at examples that live on another tab.
  if (page.kicker === 'Worked example' || page.kicker === 'Your turn') return 'example'
  if (EXAMPLE_TITLE.test(page.title)) return 'example'
  if (page.kicker === 'Top tips' || TIP_TITLE.test(page.title)) return 'tips'
  return 'core'
}

function hasSteps(page: LessonPage): boolean {
  return (
    page.blocks.filter((block) => isProse(block) && STEP.test(block.text.trim())).length >= 2
  )
}

/** Split a page into headed sections; paragraphs before any heading lead. */
function sectionize(
  page: LessonPage,
  keepPerSection: number,
  allowBangHeadings = false,
): BriefSection[] {
  const groups: { heading: string | null; blocks: LessonBlock[] }[] = [
    { heading: null, blocks: [] },
  ]

  for (const block of page.blocks) {
    if (!isProse(block)) continue
    if (isHeading(block, allowBangHeadings)) {
      groups.push({ heading: block.text.trim(), blocks: [] })
      continue
    }
    groups[groups.length - 1].blocks.push(block)
  }

  return groups
    .map((group) => ({ heading: group.heading, ...rank(toUnits(group.blocks), keepPerSection) }))
    .filter((section) => section.keep.length > 0 || section.extra.length > 0)
}

/** The opener: what this question type asks you to do. Headings ignored. */
function toAsks(page: LessonPage): BriefSection {
  const blocks = page.blocks.filter((block) => isProse(block) && !isHeading(block))
  return { heading: null, ...rank(toUnits(blocks), 2) }
}

/**
 * Cut a method page into numbered steps, one sentence of detail each. Anything
 * before step 1 is usually furniture ("consider following these steps:") but
 * occasionally carries real reasoning, so it is returned rather than dropped.
 */
function toSteps(page: LessonPage): { steps: BriefStep[]; preamble: string[] } {
  const collected: { n: number; title: string; blocks: LessonBlock[] }[] = []
  const preamble: string[] = []
  let current: { n: number; title: string; blocks: LessonBlock[] } | null = null

  for (const block of page.blocks) {
    if (!isProse(block)) continue
    const text = block.text.trim()
    const match = STEP.exec(text)
    if (match) {
      current = { n: Number(match[1]), title: match[2].trim(), blocks: [] }
      collected.push(current)
      continue
    }
    if (current === null) {
      if (!POINTER.test(text) && !ARTICLE_BOILERPLATE.test(text)) preamble.push(text)
      continue
    }
    current.blocks.push(block)
  }

  const steps = collected.map((step) => {
    const { keep, extra } = rank(toUnits(step.blocks), 1)
    return { n: step.n, title: step.title, body: keep, extra }
  })

  return { steps, preamble }
}

// --- Public API -------------------------------------------------------------

/**
 * A part can cover more than one topic — Text Structure and Purpose folds a
 * "part-to-whole relationships" deep dive into the same part. The articles mark
 * each topic by restarting with "What are X questions?", so that is the seam.
 */
function splitTopics(pages: LessonPage[]): LessonPage[][] {
  const runs: LessonPage[][] = []
  pages.forEach((page, index) => {
    if (index === 0 || TOPIC_START.test(page.title)) runs.push([page])
    else runs[runs.length - 1].push(page)
  })
  return runs
}

function briefForTopic(pages: LessonPage[]): LessonBrief {
  const methodPage = pages.find(hasSteps) ?? null
  const rest = pages.filter((page) => page !== methodPage)
  const asksPage = rest[0] ?? null

  const asks = asksPage ? toAsks(asksPage) : { heading: null, keep: [], extra: [] }
  const think = rest.slice(1).flatMap((page) => sectionize(page, 1))
  const { steps: method, preamble: methodExtra } = methodPage
    ? toSteps(methodPage)
    : { steps: [], preamble: [] }

  const hasMore =
    asks.extra.length > 0 ||
    think.some((section) => section.extra.length > 0) ||
    method.some((step) => step.extra.length > 0) ||
    methodExtra.length > 0

  return { asks, think, method, methodExtra, hasMore }
}

function briefsForPart(part: LessonPart, multipart: boolean): LessonBriefBlock[] {
  const core = part.pages.filter((page) => roleOf(page) === 'core')

  return splitTopics(core).map((pages, index) => ({
    // The first topic carries the part label; a deep dive names itself.
    partTitle: index === 0 ? (multipart ? part.title : null) : pages[0].kicker,
    partSubtitle: index === 0 ? (multipart ? part.subtitle ?? null : null) : null,
    brief: briefForTopic(pages),
  }))
}

const TIP_TITLE_PREFIX = /^top tips?\s*[:—-]\s*/i

function tipHeadingFromTitle(title: string): string {
  const cleaned = title.replace(TIP_TITLE_PREFIX, '').trim()
  if (cleaned.length === 0) return title
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function buildLessonTabs(lesson: SkillLesson): LessonTabs {
  const multipart = lesson.parts.length > 1
  const briefs = lesson.parts.flatMap((part) => briefsForPart(part, multipart))

  const examples: LessonTabs['examples'] = []
  const tips: BriefSection[] = []

  lesson.parts.forEach((part) => {
    part.pages.forEach((page) => {
      if (roleOf(page) === 'tips') {
        // Some pages carry the tip in the page title ("TOP TIP: don't worry
        // about style!") and go straight into prose, which would leave the card
        // untitled.
        tips.push(
          ...sectionize(page, 2, true).map((section) =>
            section.heading === null
              ? { ...section, heading: tipHeadingFromTitle(page.title) }
              : section,
          ),
        )
      }
      page.blocks.forEach((block, index) => {
        if (block.type !== 'example') return
        examples.push({
          key: `${part.id}:${page.id}:${index}`,
          pageTitle: page.title,
          partTitle: multipart ? part.title : null,
          example: block,
        })
      })
    })
  })

  const generalTips = sectionize(
    { id: 'general', kicker: 'Top tips', title: 'General', blocks: lesson.generalTips },
    2,
    true,
  )

  return { briefs, examples, tips, generalTips }
}
