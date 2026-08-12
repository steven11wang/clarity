// Turns the four Reading and Writing sources that make up the practice
// programme into the JSON the Bluebook-style player loads at runtime.
//
//   node tools/build-practice-exams.mjs
//
// Each source was captured from a different site, so each gets its own parser.
// Only the diagnostic ships with a key of its own; the other three are scored
// against keys written by hand in tools/practice-exam-keys.mjs and are marked
// `derived` so the report can say so.
//
// CookSAT Mock Exam 2 keeps its own script (build-practice-exam.mjs) because it
// also carries a full explanation bank.

import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { canonicalSkill, skillFromStem, TOPIC_OF } from './exam-skills.mjs'
import { ANSWER_KEYS } from './practice-exam-keys.mjs'
import { EXPLANATIONS as COOK_1 } from './explanations-cooksat-test-1.mjs'
import { EXPLANATIONS as JUNE_2026 } from './explanations-dsat-june-2026-exam-1.mjs'
import { EXPLANATIONS as AUG_2025 } from './explanations-dsat-aug-2025-us-v2.mjs'

// The review pass shows one line per choice - why the key works, why each
// distractor fails - so each bank is keyed the same way as the answer key and
// validated below against the choices actually parsed.
const EXPLANATION_BANKS = {
  'cooksat-test-1': COOK_1,
  'dsat-june-2026-exam-1': JUNE_2026,
  'dsat-aug-2025-us-v2': AUG_2025,
}

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'data', 'practice-exams')

// Digital SAT Reading and Writing: 32 minutes per module.
const MODULE_SECONDS = 32 * 60

const DIFFICULTY = {
  easy: 'easy',
  medium: 'medium',
  intermediate: 'medium',
  hard: 'hard',
  extreme: 'extreme',
}

function normalizeDifficulty(label) {
  return DIFFICULTY[String(label ?? '').trim().toLowerCase()] ?? null
}

/** Collapses wrapped source lines into one paragraph and drops markdown emphasis. */
function oneLine(text) {
  return text
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[\s("'])\*(?!\s)([^*]+?)\*(?=[\s.,;:!?)"']|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}

function blocks(text) {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}

/**
 * A "student has taken the following notes" block arrives as bare lines. The
 * player renders one paragraph per array entry, so each note becomes its own
 * bulleted entry rather than a wall of text.
 */
function expandNotes(paragraphs) {
  const out = []
  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean)
    const previous = out[out.length - 1] ?? ''
    const isNoteSet = lines.length > 1 && /notes:$/i.test(previous)
    const isBulleted = lines.length > 1 && lines.every((line) => /^[-*•]\s/.test(line))
    if (isNoteSet || isBulleted) {
      for (const line of lines) out.push(`• ${oneLine(line.replace(/^[-*•]\s*/, ''))}`)
      continue
    }
    out.push(oneLine(paragraph))
  }
  return out.filter(Boolean)
}

function parseMarkdownTable(block) {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length < 3 || !lines.every((line) => line.startsWith('|'))) return null
  if (!/^\|[\s|:-]+\|$/.test(lines[1])) return null
  const cells = (line) =>
    line.slice(1, -1).split('|').map((cell) => oneLine(cell))
  return {
    caption: null,
    headers: cells(lines[0]),
    rows: lines.slice(2).map(cells),
  }
}

function parseImage(block) {
  const match = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
  return match ? { alt: match[1], src: match[2] } : null
}

function keyFor(examId, moduleId, number) {
  return ANSWER_KEYS[examId]?.[moduleId]?.[number] ?? null
}

function explanationFor(examId, moduleId, number) {
  const entry = EXPLANATION_BANKS[examId]?.[moduleId]?.[number]
  if (!entry) return null
  return { summary: entry.summary, choices: { ...entry.choices } }
}

function taggedQuestion({ examId, moduleId, number, passage, table, figure, stem, choices, difficulty, skill, assetBase, explanation = null }) {
  const subtopic = skill ?? skillFromStem(stem, choices)
  return {
    id: `${moduleId}-q${number}`,
    number,
    passage,
    figure: figure ? { alt: figure.alt, src: `${assetBase}/${path.basename(figure.src)}` } : null,
    table: table ?? null,
    stem,
    choices,
    answer: keyFor(examId, moduleId, number),
    topic: subtopic ? TOPIC_OF[subtopic] ?? null : null,
    subtopic: subtopic ?? null,
    difficulty,
    explanation: explanation ?? explanationFor(examId, moduleId, number),
  }
}

// --- Source 1: Kaplan diagnostic (exam_questions_reading_writing.md) --------
// Ships with the official key and a written explanation per question, which is
// what makes it usable as the untimed-dictionary diagnostic.

function parseDiagnosticChoices(text) {
  const MARKERS = /^(Correct answer|Incorrect answer|\(Correct\)|\(Incorrect\)|close)$/
  const choices = []
  let answer = null
  let pendingKey = false
  let current = null

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (MARKERS.test(line)) {
      if (line === 'Correct answer') pendingKey = true
      continue
    }
    if (/^[A-D]$/.test(line)) {
      current = { letter: line, text: '' }
      choices.push(current)
      if (pendingKey) answer = line
      pendingKey = false
      continue
    }
    if (current) current.text = `${current.text} ${line}`.trim()
  }

  return { choices: choices.map((c) => ({ ...c, text: oneLine(c.text) })), answer }
}

function parseDiagnosticQuestion(chunk, moduleId, assetBase) {
  const number = Number(chunk.match(/^###\s+Question\s+(\d+)/)[1])
  const meta = Object.fromEntries(
    [...chunk.matchAll(/^-\s+(Topic|Subtopic|Difficulty):\s*(.+)$/gm)].map((m) => [m[1], m[2].trim()]),
  )
  const figureMatch = chunk.match(/^!\[([^\]]*)\]\(([^)]+)\)$/m)
  const pres = [...chunk.matchAll(/<pre>\n([\s\S]*?)\n<\/pre>/g)].map((m) => m[1])
  const [body, explanationText] = pres

  const [beforeChoices, afterChoices] = body.split(/^Answer choices$/m)
  const { choices, answer } = parseDiagnosticChoices(afterChoices ?? '')
  const parts = expandNotes(blocks(beforeChoices))
  const stem = parts.pop() ?? ''
  const skill = canonicalSkill(meta.Subtopic)

  return {
    id: `${moduleId}-q${number}`,
    number,
    passage: parts,
    figure: figureMatch
      ? { alt: figureMatch[1], src: `${assetBase}/${path.basename(figureMatch[2])}` }
      : null,
    table: null,
    stem,
    choices,
    answer,
    topic: skill ? TOPIC_OF[skill] ?? null : null,
    subtopic: skill ?? null,
    difficulty: normalizeDifficulty(meta.Difficulty),
    explanation: explanationText
      ? {
          summary: blocks(explanationText.replace(/^Getting to the Answer:\s*/, '')).map(oneLine).join('\n\n'),
          choices: {},
        }
      : null,
  }
}

async function buildDiagnostic() {
  const examId = 'kaplan-diagnostic'
  const assetBase = `${examId}-assets`
  const markdown = await readFile(path.join(ROOT, 'exam_questions_reading_writing.md'), 'utf8')

  const modules = markdown
    .split(/\n(?=##\s+Reading\/Writing Module\s)/)
    .filter((chunk) => /^##\s+Reading\/Writing Module/.test(chunk.trim()))
    .map((chunk, index) => {
      const moduleId = `module-${index + 1}`
      const questions = chunk
        .split(/\n(?=###\s+Question\s)/)
        .filter((part) => /^###\s+Question\s/.test(part.trim()))
        .map((part) => parseDiagnosticQuestion(part.trim(), moduleId, assetBase))
      return {
        id: moduleId,
        number: index + 1,
        subject: 'Reading and Writing',
        label: `Module ${index + 1}`,
        durationSeconds: MODULE_SECONDS,
        questions,
      }
    })

  return {
    exam: {
      id: examId,
      title: 'Diagnostic Reading and Writing',
      section: 'Section 1',
      subject: 'Reading and Writing',
      answerKeySource: 'official',
      assetBase,
      modules,
    },
    sourceAssets: path.join(ROOT, 'exam_questions_reading_writing_assets'),
  }
}

// --- Source 2: CookSAT Practice Test 1 (cooksat-test-1.md) ------------------
// The capture holds both sections; only Reading and Writing is used. No skill
// labels and no key, so both are inferred/supplied here.

function parseCookQuestion(chunk, moduleId, examId, assetBase) {
  const heading = chunk.match(/^####\s+Question\s+(\d+)\s*—\s*(.+)$/m)
  const number = Number(heading[1])
  const difficulty = normalizeDifficulty(heading[2])

  const body = chunk.slice(chunk.indexOf('\n') + 1)
  const sections = body.split(/^\*\*(Passage \/ prompt|Additional text|Question|Answer choices):\*\*$/m)
  const named = {}
  // A cross-text question arrives as two "Additional text" blocks in a row.
  const texts = []
  for (let i = 1; i < sections.length; i += 2) {
    const label = sections[i]
    const content = sections[i + 1] ?? ''
    if (label === 'Passage / prompt' || label === 'Additional text') texts.push(content)
    else named[label] = content
  }

  let figure = null
  const passage = texts.flatMap((text, index) => {
    const paragraphs = expandNotes(
      blocks(text).filter((block) => {
        const image = parseImage(block)
        if (image) {
          figure = image
          return false
        }
        // "*Recreated visual (table).*" is a capture note, not passage prose.
        return !/^\*Recreated visual/.test(block)
      }),
    )
    return texts.length > 1 ? [`Text ${index + 1}`, ...paragraphs] : paragraphs
  })

  // Seven Rhetorical Synthesis items came out of CookSAT with the "student has
  // taken the following notes" line but no notes under it. They are still
  // answerable from the goal and the choices, so they stay in the exam - but
  // say so rather than leaving what looks like a broken screen.
  if (/notes:$/i.test(passage[passage.length - 1] ?? '')) {
    passage.push('[The note list did not come through in this capture. Work from the stated goal and the choices.]')
  }

  const choices = blocks(named['Answer choices'] ?? '')
    .join('\n')
    .split('\n')
    .map((line) => line.match(/^([A-D])\.\s+(.+)$/))
    .filter(Boolean)
    .map((match) => ({ letter: match[1], text: oneLine(match[2]) }))

  return taggedQuestion({
    examId,
    moduleId,
    number,
    passage,
    figure,
    stem: oneLine(blocks(named.Question ?? '').join(' ')),
    choices,
    difficulty,
    skill: null,
    assetBase,
  })
}

async function buildCookTest1() {
  const examId = 'cooksat-test-1'
  const assetBase = `${examId}-assets`
  const markdown = await readFile(path.join(ROOT, 'cooksat-test-1.md'), 'utf8')

  // The file runs "## Reading and Writing" then "## Math"; drop everything from
  // the Math heading on.
  const readingSection = markdown
    .split(/\n(?=##\s+(?!#))/)
    .find((chunk) => /^##\s+Reading and Writing/.test(chunk.trim()))

  const modules = readingSection
    .split(/\n(?=###\s+Module\s)/)
    .filter((chunk) => /^###\s+Module\s/.test(chunk.trim()))
    .map((chunk, index) => {
      const moduleId = `module-${index + 1}`
      const questions = chunk
        .split(/\n(?=####\s+Question\s)/)
        .filter((part) => /^####\s+Question\s/.test(part.trim()))
        .map((part) => parseCookQuestion(part.trim(), moduleId, examId, assetBase))
      return {
        id: moduleId,
        number: index + 1,
        subject: 'Reading and Writing',
        label: `Module ${index + 1}`,
        durationSeconds: MODULE_SECONDS,
        questions,
      }
    })

  return {
    exam: {
      id: examId,
      title: 'CookSAT Practice Test 1',
      section: 'Section 1',
      subject: 'Reading and Writing',
      answerKeySource: 'derived',
      assetBase,
      modules,
    },
    sourceAssets: path.join(ROOT, 'cooksat-test-1-assets'),
    assetFilter: (name) => name.startsWith('english-'),
  }
}

// --- Source 3: TestAdvantage June 2026 practice exam 1 ----------------------

function parseTestAdvantageQuestion(chunk, moduleId, examId, assetBase) {
  const number = Number(chunk.match(/Question\s+(\d+)/)[1])
  const meta = chunk.match(/^\*(.+?)\s+·\s+difficulty:\s+\*\*(\w+)\*\*/m)
  const skill = canonicalSkill(meta?.[1])
  const difficulty = normalizeDifficulty(meta?.[2])

  let figure = null
  let table = null
  const passage = []

  for (const block of blocks(chunk.slice(chunk.indexOf('\n') + 1))) {
    if (/^\*.+·\s+difficulty:/.test(block)) continue
    if (/^-\s+\*\*[A-D]\)\*\*/.test(block)) continue
    // The domain sub-heading that opens the next block of questions, and the
    // rule that closes the last one.
    if (block.startsWith('#')) continue
    if (/^-{3,}$/.test(block)) continue
    // "**Text 1**" labels a passage in a cross-text pair; it reads as its own
    // line above the text it names.
    const paired = block.match(/^\*\*(Text \d)\*\*\n([\s\S]+)$/)
    if (paired) {
      passage.push(paired[1], paired[2])
      continue
    }
    const image = parseImage(block)
    if (image) {
      figure = image
      continue
    }
    const parsed = parseMarkdownTable(block)
    if (parsed) {
      table = parsed
      continue
    }
    // A lone bold line above a figure or table is its title.
    if (/^\*\*[^*]+\*\*$/.test(block)) {
      const caption = oneLine(block)
      if (table && !table.caption) table.caption = caption
      else passage.push(caption)
      continue
    }
    passage.push(block)
  }

  const expanded = expandNotes(passage)
  const stem = expanded.pop() ?? ''

  const choices = [...chunk.matchAll(/^-\s+\*\*([A-D])\)\*\*\s+(.+)$/gm)].map((match) => ({
    letter: match[1],
    text: oneLine(match[2]),
  }))

  // A figure caption that repeats the alt text adds nothing next to the chart.
  const cleaned = figure
    ? expanded.filter((line) => line !== oneLine(figure.alt))
    : expanded

  if (table && !table.caption && cleaned.length && cleaned[0].length < 80) {
    table.caption = cleaned.shift()
  }

  return taggedQuestion({
    examId,
    moduleId,
    number,
    passage: cleaned,
    table,
    figure,
    stem,
    choices,
    difficulty,
    skill,
    assetBase,
  })
}

async function buildJune2026() {
  const examId = 'dsat-june-2026-exam-1'
  const assetBase = `${examId}-assets`
  const source = path.join(ROOT, 'dsat-english-june-2026-practice-exam-1')
  const markdown = await readFile(
    path.join(source, 'dsat-english-june-2026-practice-exam-1.md'),
    'utf8',
  )

  const modules = markdown
    .split(/\n(?=##\s+(?!#))/)
    .filter((chunk) => /^##\s+Module\s+\d/.test(chunk.trim()))
    .map((chunk, index) => {
      const moduleId = `module-${index + 1}`
      const questions = chunk
        .split(/\n(?=####\s+Module\s+\d+\s+—\s+Question\s)/)
        .filter((part) => /^####\s+Module/.test(part.trim()))
        .map((part) => parseTestAdvantageQuestion(part.trim(), moduleId, examId, assetBase))
      return {
        id: moduleId,
        number: index + 1,
        subject: 'Reading and Writing',
        label: `Module ${index + 1}`,
        durationSeconds: MODULE_SECONDS,
        questions,
      }
    })

  return {
    exam: {
      id: examId,
      title: 'Digital SAT June 2026 · Exam 1',
      section: 'Section 1',
      subject: 'Reading and Writing',
      answerKeySource: 'derived',
      assetBase,
      modules,
    },
    sourceAssets: path.join(source, 'assets'),
  }
}

// --- Source 4: TestAdvantage August 2025 US, version 2 ----------------------
// Numbered 1-54 straight through; module 2 is renumbered to 1-27 so the player
// counts each module from one, as the real app does.

function parseAugustQuestion(chunk, moduleId, number, examId, assetBase) {
  const skill = canonicalSkill(chunk.match(/^\*\*Skill:\*\*.*\|\s*([^|\n]+)$/m)?.[1])
  const difficulty = normalizeDifficulty(
    chunk.match(/^\*\*Difficulty \(as shown on site\):\*\*\s*(\w+)/m)?.[1],
  )

  let figure = null
  const passageBlocks = []
  let stem = ''

  for (const block of blocks(chunk.slice(chunk.indexOf('\n') + 1))) {
    if (/^\*\*(Difficulty|Skill)/.test(block)) continue
    if (/^-{3,}$/.test(block)) continue
    if (/^-\s+[A-D]\.\s/.test(block)) continue
    if (block === '**Passage:**') continue
    const image = parseImage(block)
    if (image) {
      figure = image
      continue
    }
    const question = block.match(/^\*\*Question:\*\*\s*([\s\S]+)$/)
    if (question) {
      stem = oneLine(question[1])
      continue
    }
    passageBlocks.push(block)
  }

  const choices = [...chunk.matchAll(/^-\s+([A-D])\.\s+(.+)$/gm)].map((match) => ({
    letter: match[1],
    text: oneLine(match[2]),
  }))

  return taggedQuestion({
    examId,
    moduleId,
    number,
    passage: expandNotes(passageBlocks),
    figure,
    stem,
    choices,
    difficulty,
    skill,
    assetBase,
  })
}

async function buildAugust2025() {
  const examId = 'dsat-aug-2025-us-v2'
  const assetBase = `${examId}-assets`
  const source = path.join(ROOT, 'dsat-english-aug-2025-us-v2')
  const markdown = await readFile(
    path.join(source, 'dsat-english-august-2025-us-version-2.md'),
    'utf8',
  )

  const modules = markdown
    .split(/\n(?=##\s+(?!#))/)
    .filter((chunk) => /^##\s+Module\s+\d/.test(chunk.trim()))
    .map((chunk, index) => {
      const moduleId = `module-${index + 1}`
      const questions = chunk
        .split(/\n(?=###\s+Question\s)/)
        .filter((part) => /^###\s+Question\s/.test(part.trim()))
        .map((part, order) =>
          parseAugustQuestion(part.trim(), moduleId, order + 1, examId, assetBase),
        )
      return {
        id: moduleId,
        number: index + 1,
        subject: 'Reading and Writing',
        label: `Module ${index + 1}`,
        durationSeconds: MODULE_SECONDS,
        questions,
      }
    })

  return {
    exam: {
      id: examId,
      title: 'Digital SAT August 2025 · US',
      section: 'Section 1',
      subject: 'Reading and Writing',
      answerKeySource: 'derived',
      assetBase,
      modules,
    },
    sourceAssets: path.join(source, 'assets'),
  }
}

// --- Write ------------------------------------------------------------------

async function emit({ exam, sourceAssets, assetFilter }) {
  if (sourceAssets) {
    const outAssets = path.join(OUT_DIR, exam.assetBase)
    await mkdir(outAssets, { recursive: true })
    for (const name of await readdir(sourceAssets)) {
      if (name.startsWith('.')) continue
      if (assetFilter && !assetFilter(name)) continue
      await copyFile(path.join(sourceAssets, name), path.join(outAssets, name))
    }
  }

  const out = path.join(OUT_DIR, `${exam.id}.json`)
  await writeFile(out, `${JSON.stringify(exam, null, 2)}\n`)

  const questions = exam.modules.flatMap((module) => module.questions)
  const problems = questions.filter((question) => question.choices.length !== 4)
  const unkeyed = questions.filter((question) => !question.answer)
  const untagged = questions.filter((question) => !question.subtopic)
  const empty = questions.filter(
    (question) => question.passage.length === 0 && !question.figure && !question.table,
  )
  // An explanation that skips a choice leaves a blank panel in the review pass,
  // so a gap fails the build rather than shipping silently. Exams with no bank
  // at all are exempt - the player says so on screen instead.
  const unexplained = EXPLANATION_BANKS[exam.id]
    ? questions.filter(
        (question) =>
          !question.explanation ||
          !question.explanation.summary ||
          question.choices.some((choice) => !question.explanation.choices[choice.letter]),
      )
    : []

  console.log(
    `${exam.id}: ${exam.modules.length} modules, ${questions.length} questions` +
      `${problems.length ? ` | BAD CHOICES: ${problems.map((q) => q.id).join(', ')}` : ''}` +
      `${unkeyed.length ? ` | no key: ${unkeyed.length}` : ''}` +
      `${untagged.length ? ` | untagged: ${untagged.map((q) => q.id).join(', ')}` : ''}` +
      `${empty.length ? ` | no passage: ${empty.map((q) => q.id).join(', ')}` : ''}`,
  )
  if (unexplained.length) {
    console.error(`  missing explanations: ${unexplained.map((q) => q.id).join(', ')}`)
    process.exitCode = 1
  }
}

await mkdir(OUT_DIR, { recursive: true })
for (const build of [buildDiagnostic, buildCookTest1, buildJune2026, buildAugust2025]) {
  await emit(await build())
}
