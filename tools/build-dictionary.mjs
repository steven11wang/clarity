// Bakes the passage vocabulary into public/data/dictionary.json so the app can
// show Merriam-Webster definitions without ever holding an API key.
//
//   node --env-file-if-exists=.env.local tools/build-dictionary.mjs
//   node --env-file-if-exists=.env.local tools/build-dictionary.mjs --budget=200
//
// Merriam-Webster's free tier allows 1000 lookups per key per day and the
// corpus runs to several thousand words, so this is written to be run again and
// again: every run tops the file up by at most --budget words and leaves what
// it already has alone. Rarest words go first, because those are the ones a
// test-taker actually taps; anything not yet baked still resolves through the
// live fallback in src/dictionary/lookup.ts.
//
// Keys come from .env.local and stay on this machine:
//   MERRIAM_WEBSTER_LEARNERS_KEY   - learners' dictionary, the plain-English one
//   MERRIAM_WEBSTER_COLLEGIATE_KEY - collegiate, for words the learners' lacks

import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { normalizeWord } from '../src/dictionary/lookup.ts'
import { isMissPayload, parseMerriamWebster } from '../src/dictionary/merriamWebster.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA_DIR = path.join(ROOT, 'public', 'data')
const EXAM_DIR = path.join(DATA_DIR, 'practice-exams')
const OUT_FILE = path.join(DATA_DIR, 'dictionary.json')

const MW_BASE = 'https://dictionaryapi.com/api/v3/references'

// Merriam-Webster's published free-tier ceiling, minus room for a retry or two.
const DEFAULT_BUDGET = 950
// Enough senses for the "other meanings" list without bloating the payload.
const MAX_SENSES = 6
const MAX_EXAMPLES = 3
const CONCURRENCY = 4

const FORMAT_VERSION = 1

// --- Arguments ---------------------------------------------------------------

function readFlag(name, fallback) {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return match ? match.slice(name.length + 3) : fallback
}

const budget = Number(readFlag('budget', DEFAULT_BUDGET))
const learnersKey = process.env.MERRIAM_WEBSTER_LEARNERS_KEY?.trim()
const collegiateKey = process.env.MERRIAM_WEBSTER_COLLEGIATE_KEY?.trim()

// --- Corpus ------------------------------------------------------------------

// Function words carry no dictionary value and would burn the daily budget.
const SKIP = new Set([
  'the', 'and', 'that', 'this', 'these', 'those', 'with', 'from', 'have', 'has',
  'had', 'been', 'was', 'were', 'are', 'for', 'not', 'but', 'they', 'them',
  'their', 'there', 'here', 'she', 'his', 'her', 'hers', 'him', 'our', 'ours',
  'you', 'your', 'yours', 'its', 'who', 'whom', 'which', 'what', 'when',
  'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'than', 'too', 'very', 'can', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'into', 'onto', 'out',
  'off', 'over', 'under', 'again', 'once', 'only', 'own', 'same', 'because',
  'while', 'about', 'against', 'between', 'through', 'during', 'before',
  'after', 'above', 'below', 'then', 'also', 'does', 'did', 'doing', 'being',
])

/** Every string in a JSON tree, tags stripped. */
function collectText(value, out) {
  if (typeof value === 'string') out.push(value.replace(/<[^>]*>/g, ' '))
  else if (Array.isArray(value)) value.forEach((item) => collectText(item, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectText(item, out))
}

async function corpusWords() {
  const files = [path.join(DATA_DIR, 'questions.json')]
  for (const name of await readdir(EXAM_DIR)) {
    if (name.endsWith('.json')) files.push(path.join(EXAM_DIR, name))
  }

  const text = []
  for (const file of files) {
    try {
      collectText(JSON.parse(await readFile(file, 'utf8')), text)
    } catch (error) {
      console.warn(`  skipped ${path.relative(ROOT, file)}: ${error.message}`)
    }
  }

  const counts = new Map()
  for (const chunk of text) {
    for (const token of chunk.split(/[^A-Za-z'’-]+/)) {
      const word = normalizeWord(token)
      // Hyphenated compounds are rarely their own entry; the parts are.
      if (word.length > 2 && !word.includes('-') && !SKIP.has(word)) {
        counts.set(word, (counts.get(word) ?? 0) + 1)
      }
    }
  }
  return counts
}

// --- Existing file -----------------------------------------------------------

async function readBaked() {
  try {
    const parsed = JSON.parse(await readFile(OUT_FILE, 'utf8'))
    if (parsed?.version === FORMAT_VERSION && parsed.words) {
      return parsed
    }
  } catch {
    // No file yet, or one written by an older format: start over.
  }
  return { version: FORMAT_VERSION, generatedAt: null, source: '', words: {} }
}

// --- Network -----------------------------------------------------------------

async function getJson(url, label) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${label} responded ${response.status}`)
  const body = await response.text()
  try {
    return JSON.parse(body)
  } catch {
    // MW reports quota and key problems as bare text.
    throw new Error(`${label}: ${body.slice(0, 120)}`)
  }
}

async function lookupReference(reference, key, word) {
  const url = `${MW_BASE}/${reference}/json/${encodeURIComponent(word)}?key=${key}`
  const payload = await getJson(url, `Merriam-Webster ${reference}`)
  if (isMissPayload(payload)) return null
  const senses = parseMerriamWebster(payload, word)
  return senses.length > 0 ? senses : null
}

/** The learners' dictionary is the plainer read; collegiate covers its gaps. */
async function defineWord(word) {
  const learners = await lookupReference('learners', learnersKey, word)
  if (learners) return { senses: learners, reference: 'learners' }
  if (!collegiateKey) return null
  const collegiate = await lookupReference('collegiate', collegiateKey, word)
  return collegiate ? { senses: collegiate, reference: 'collegiate' } : null
}

// --- Shaping -----------------------------------------------------------------

/** Tuples rather than objects: the same data, roughly half the bytes. */
function packSenses(senses) {
  return senses.slice(0, MAX_SENSES).map((sense, index) => {
    const example = index < MAX_EXAMPLES ? sense.example : null
    const tuple = [sense.partOfSpeech, sense.definition]
    if (example) tuple.push(example)
    return tuple
  })
}

// --- Runner ------------------------------------------------------------------

/** Runs `worker` over `items` a few at a time, stopping on the first failure. */
async function pooled(items, worker) {
  let cursor = 0
  const lanes = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index], index)
    }
  })
  await Promise.all(lanes)
}

async function main() {
  if (!learnersKey) {
    console.error(
      'Missing MERRIAM_WEBSTER_LEARNERS_KEY.\n' +
      'Add it to .env.local and run with: node --env-file-if-exists=.env.local tools/build-dictionary.mjs',
    )
    process.exitCode = 1
    return
  }

  const counts = await corpusWords()
  const baked = await readBaked()
  console.log(`Corpus: ${counts.size} words. Already baked: ${Object.keys(baked.words).length}.`)

  // Commonest in the passages first. A word the exams use repeatedly is one a
  // test-taker is likely to tap, and it is far likelier to have a dictionary
  // entry than the single-appearance tail, which is mostly names and the odd
  // scanning artefact. Alphabetical within a tie, so runs are reproducible.
  const pending = [...counts]
    .filter(([word]) => !(word in baked.words))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word]) => word)

  if (pending.length === 0) {
    console.log('Nothing left to look up.')
    return
  }

  const batch = pending.slice(0, budget)
  console.log(`Looking up ${batch.length} of them (budget ${budget})…`)

  let found = 0
  let missing = 0
  let failure = null

  await pooled(batch, async (word) => {
    if (failure) return
    try {
      const entry = await defineWord(word)
      if (entry) {
        found += 1
        baked.words[word] = {
          s: packSenses(entry.senses),
          ...(entry.reference === 'collegiate' ? { r: 'collegiate' } : {}),
        }
      } else {
        missing += 1
        // Remembered so tomorrow's run does not spend budget on it again.
        baked.words[word] = null
      }
    } catch (error) {
      failure = error
    }
  })

  baked.generatedAt = new Date().toISOString()
  baked.source = "Merriam-Webster's Learner's and Collegiate Dictionaries (dictionaryapi.com)"
  await writeFile(OUT_FILE, JSON.stringify(baked), 'utf8')

  const total = Object.keys(baked.words).length
  const bytes = JSON.stringify(baked).length
  console.log(
    `Wrote ${path.relative(ROOT, OUT_FILE)}: +${found} defined, +${missing} not in either dictionary.\n` +
    `  ${total} of ${counts.size} corpus words resolved, ${(bytes / 1024 / 1024).toFixed(2)} MB.`,
  )

  if (failure) {
    console.error(`\nStopped early: ${failure.message}`)
    console.error('Progress above is saved. Re-run tomorrow to continue.')
    process.exitCode = 1
  } else if (total < counts.size) {
    console.log(`  ${counts.size - total} still to go - re-run after the daily quota resets.`)
  }
}

await main()
