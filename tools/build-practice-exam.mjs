// Turns the CookSAT mock-exam markdown into the JSON the Bluebook-style exam
// player loads at runtime, and copies its figures into public/.
//
//   node tools/build-practice-exam.mjs
//
// The markdown is authored by hand and holds no answer key, so the key lives
// here (ANSWER_KEY) and is marked `derived` in the output - the player labels
// scores accordingly.

import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SOURCE_MD = path.join(ROOT, 'cooksat-mock-exam-2-reading-writing.md')
const SOURCE_ASSETS = path.join(ROOT, 'cooksat-mock-exam-2-assets')
const OUT_DIR = path.join(ROOT, 'public', 'data', 'practice-exams')
const OUT_ASSET_DIR = path.join(OUT_DIR, 'cooksat-mock-exam-2-assets')
const OUT_FILE = path.join(OUT_DIR, 'cooksat-mock-exam-2.json')

const EXAM_ID = 'cooksat-mock-exam-2'
const EXAM_TITLE = 'CookSAT Mock Exam 2'
const SECTION_LABEL = 'Section 1'
// Digital SAT Reading and Writing: 32 minutes per module.
const MODULE_SECONDS = 32 * 60

// A short block that sits next to a figure is an axis tick or a table cell the
// figure already renders, not passage prose.
const FIGURE_NOISE_MAX_CHARS = 60

const ANSWER_KEY = {
  'module-1': {
    1: 'B', 2: 'C', 3: 'A', 4: 'C', 5: 'B', 6: 'B', 7: 'B', 8: 'D', 9: 'B',
    10: 'B', 11: 'A', 12: 'C', 13: 'C', 14: 'D', 15: 'D', 16: 'A', 17: 'C',
    18: 'A', 19: 'D', 20: 'A', 21: 'D', 22: 'C', 23: 'D', 24: 'A', 25: 'D',
    26: 'C', 27: 'A',
  },
  'module-2': {
    1: 'A', 2: 'C', 3: 'C', 4: 'D', 5: 'B', 6: 'C', 7: 'B', 8: 'A', 9: 'D',
    10: 'A', 11: 'B', 12: 'D', 13: 'D', 14: 'B', 15: 'B', 16: 'A', 17: 'D',
    18: 'A', 19: 'A', 20: 'D', 21: 'C', 22: 'D', 23: 'C', 24: 'B', 25: 'A',
    26: 'C', 27: 'B',
  },
}

function splitBlocks(text) {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}

function parseChoice(block) {
  const match = block.match(/^-\s+\*\*([A-D])\.\*\*\s+([\s\S]+)$/)
  if (!match) return null
  return { letter: match[1], text: match[2].replace(/\s+/g, ' ').trim() }
}

function parseImage(block) {
  const match = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
  if (!match) return null
  return { alt: match[1], src: match[2] }
}

function parseQuestion(raw, moduleId) {
  const [heading, ...rest] = raw.split('\n')
  const number = Number(heading.match(/Question\s+(\d+)/)[1])
  const blocks = splitBlocks(rest.join('\n'))

  const choices = []
  const body = []
  let figure = null

  for (const block of blocks) {
    const choice = parseChoice(block)
    if (choice) {
      choices.push(choice)
      continue
    }
    const image = parseImage(block)
    if (image) {
      figure = image
      continue
    }
    body.push(block)
  }

  const stem = body.pop() ?? ''
  const passage = body
    .filter((block) => !figure || block.length > FIGURE_NOISE_MAX_CHARS)
    .map((block) => block.replace(/\s*\n\s*/g, ' ').trim())

  return {
    id: `${moduleId}-q${number}`,
    number,
    passage,
    figure: figure
      ? { alt: figure.alt, src: `${path.basename(path.dirname(figure.src))}/${path.basename(figure.src)}` }
      : null,
    stem: stem.replace(/\s*\n\s*/g, ' ').trim(),
    choices,
    answer: ANSWER_KEY[moduleId]?.[number] ?? null,
  }
}

function parseModule(raw, index) {
  const [heading, ...rest] = raw.split('\n')
  const moduleId = `module-${index + 1}`
  const questions = rest
    .join('\n')
    .split(/\n(?=###\s+Question\s)/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith('### Question'))
    .map((chunk) => parseQuestion(chunk.replace(/^###\s+/, ''), moduleId))

  return {
    id: moduleId,
    number: index + 1,
    // "Reading & Writing — Module 1" -> "Reading and Writing"
    subject: heading.replace(/^##\s+/, '').split('—')[0].replace('&', 'and').trim(),
    label: `Module ${index + 1}`,
    durationSeconds: MODULE_SECONDS,
    questions,
  }
}

const markdown = await readFile(SOURCE_MD, 'utf8')
const modules = markdown
  .split(/\n(?=##\s+(?!#))/)
  .map((chunk) => chunk.trim())
  .filter((chunk) => /^##\s+Reading/.test(chunk))
  .map(parseModule)

const exam = {
  id: EXAM_ID,
  title: EXAM_TITLE,
  section: SECTION_LABEL,
  subject: 'Reading and Writing',
  answerKeySource: 'derived',
  assetBase: 'cooksat-mock-exam-2-assets',
  modules,
}

await mkdir(OUT_ASSET_DIR, { recursive: true })
for (const name of await readdir(SOURCE_ASSETS)) {
  if (name.startsWith('.')) continue
  await copyFile(path.join(SOURCE_ASSETS, name), path.join(OUT_ASSET_DIR, name))
}
await writeFile(OUT_FILE, `${JSON.stringify(exam, null, 2)}\n`)

const missing = modules.flatMap((module) =>
  module.questions
    .filter((question) => question.choices.length !== 4 || !question.answer)
    .map((question) => question.id),
)

console.log(
  `wrote ${path.relative(ROOT, OUT_FILE)} - ${modules.length} modules, ` +
    `${modules.reduce((sum, module) => sum + module.questions.length, 0)} questions`,
)
if (missing.length) console.warn(`incomplete questions: ${missing.join(', ')}`)
