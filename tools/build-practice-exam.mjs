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

import { EXPLANATIONS } from './practice-exam-2-explanations.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const SOURCE_MD = path.join(ROOT, 'cooksat-mock-exam-2-reading-writing.md')
const SOURCE_ASSETS = path.join(ROOT, 'cooksat-mock-exam-2-assets')
const OUT_DIR = path.join(ROOT, 'public', 'data', 'practice-exams')
const OUT_ASSET_DIR = path.join(OUT_DIR, 'cooksat-mock-exam-2-assets')
const OUT_FILE = path.join(OUT_DIR, 'cooksat-mock-exam-2.json')

const EXAM_ID = 'cooksat-mock-exam-2'
const EXAM_TITLE = 'CookSAT Practice Test 2'
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

// Per-question difficulty, one letter per question in exam order:
// E)asy, M)edium, H)ard. Supplied by hand rather than read from the
// `> Difficulty:` lines in the markdown - those carry CookSAT's own four-level
// labels, and this index is the one the report is meant to show.
const DIFFICULTY_INDEX = {
  'module-1': 'EEEEEEMEHEEEEHMEEMMEEHEMEEM',
  'module-2': 'EMMEMMMMHMHMHMEHMMEHMEMMEEE',
}
const DIFFICULTY_NAME = { E: 'easy', M: 'medium', H: 'hard', X: 'extreme' }

// Skill taxonomy per question, so the report can break a score down by domain.
const CRAFT = 'Craft and Structure'
const INFO = 'Information and Ideas'
const CONVENTIONS = 'Standard English Conventions'
const EXPRESSION = 'Expression of Ideas'

const SUBTOPIC = {
  'module-1': {
    1: 'Words in Context', 2: 'Words in Context', 3: 'Words in Context',
    4: 'Words in Context', 5: 'Text Structure and Purpose',
    6: 'Text Structure and Purpose', 7: 'Cross-Text Connections',
    8: 'Central Ideas and Details', 9: 'Inferences', 10: 'Inferences',
    11: 'Command of Evidence', 12: 'Command of Evidence',
    13: 'Command of Evidence', 14: 'Command of Evidence', 15: 'Inferences',
    16: 'Form, Structure, and Sense', 17: 'Form, Structure, and Sense',
    18: 'Form, Structure, and Sense', 19: 'Boundaries', 20: 'Boundaries',
    21: 'Transitions', 22: 'Transitions', 23: 'Rhetorical Synthesis',
    24: 'Rhetorical Synthesis', 25: 'Rhetorical Synthesis',
    26: 'Rhetorical Synthesis', 27: 'Rhetorical Synthesis',
  },
  'module-2': {
    1: 'Words in Context', 2: 'Words in Context', 3: 'Words in Context',
    4: 'Words in Context', 5: 'Text Structure and Purpose',
    6: 'Text Structure and Purpose', 7: 'Central Ideas and Details',
    8: 'Command of Evidence', 9: 'Command of Evidence',
    10: 'Command of Evidence', 11: 'Inferences', 12: 'Inferences',
    13: 'Inferences', 14: 'Inferences', 15: 'Form, Structure, and Sense',
    16: 'Boundaries', 17: 'Boundaries', 18: 'Form, Structure, and Sense',
    19: 'Boundaries', 20: 'Form, Structure, and Sense',
    21: 'Form, Structure, and Sense', 22: 'Transitions', 23: 'Transitions',
    24: 'Transitions', 25: 'Rhetorical Synthesis', 26: 'Rhetorical Synthesis',
    27: 'Rhetorical Synthesis',
  },
}

const TOPIC_OF = {
  'Words in Context': CRAFT,
  'Text Structure and Purpose': CRAFT,
  'Cross-Text Connections': CRAFT,
  'Central Ideas and Details': INFO,
  'Command of Evidence': INFO,
  Inferences: INFO,
  Boundaries: CONVENTIONS,
  'Form, Structure, and Sense': CONVENTIONS,
  Transitions: EXPRESSION,
  'Rhetorical Synthesis': EXPRESSION,
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

// The review pass shows one line per choice - why the key works, why each
// distractor fails - so the explanation bank is keyed the same way as the
// answer key and validated below against the choices actually parsed.
function explanationOf(moduleId, number) {
  const entry = EXPLANATIONS[moduleId]?.[number]
  if (!entry) return null
  return { summary: entry.summary, choices: { ...entry.choices } }
}

function difficultyOf(moduleId, number) {
  const letter = DIFFICULTY_INDEX[moduleId]?.[number - 1]
  return DIFFICULTY_NAME[letter] ?? null
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
    // The markdown annotates each question with a `> Difficulty: **...**` line.
    // It is metadata, not passage prose, so it never reaches the body.
    if (/^>\s*Difficulty:/i.test(block)) continue
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
    topic: TOPIC_OF[SUBTOPIC[moduleId]?.[number]] ?? null,
    subtopic: SUBTOPIC[moduleId]?.[number] ?? null,
    difficulty: difficultyOf(moduleId, number),
    explanation: explanationOf(moduleId, number),
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

// An explanation that skips a choice would leave a blank panel in the review
// pass, so a gap here fails the build rather than shipping silently.
const unexplained = modules.flatMap((module) =>
  module.questions
    .filter(
      (question) =>
        !question.explanation ||
        !question.explanation.summary ||
        question.choices.some((choice) => !question.explanation.choices[choice.letter]),
    )
    .map((question) => question.id),
)

console.log(
  `wrote ${path.relative(ROOT, OUT_FILE)} - ${modules.length} modules, ` +
    `${modules.reduce((sum, module) => sum + module.questions.length, 0)} questions`,
)
if (missing.length) console.warn(`incomplete questions: ${missing.join(', ')}`)
if (unexplained.length) {
  console.error(`missing explanations: ${unexplained.join(', ')}`)
  process.exitCode = 1
}
