// Tapping a word in a passage asks what it means, and the answer is cached so
// the second tap (and the next session) is instant.
//
// Definitions come from Merriam-Webster's Learner's Dictionary, baked into
// /data/dictionary.json at build time by tools/build-dictionary.mjs. Baking
// rather than calling the API keeps the key off a static site, survives an
// outage mid-exam, and costs one cached download instead of a request per tap.
// Words outside the passage corpus - or not yet baked, since the free tier is
// metered per day - fall back to dictionaryapi.dev, which needs no key.
//
// Either source answers with every sense of the word, so the work here is
// picking the one that fits the sentence the learner is actually reading.

import { assetPath } from '../lib/assetPath.ts'

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en'
const BAKED_PATH = '/data/dictionary.json'
const CACHE_KEY = 'clarity:v1:dictionary-cache'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const CACHE_LIMIT = 400
const MAX_DEFINITION_CHARS = 180

export type WordSense = {
  partOfSpeech: string
  definition: string
  example: string | null
}

export type LookupResult =
  | { status: 'found'; word: string; senses: WordSense[] }
  | { status: 'missing'; word: string }

type CacheRecord = { result: LookupResult; cachedAt: number }

// --- Word shapes ------------------------------------------------------------

/** 'Ambivalent,' -> 'ambivalent'. Keeps inner hyphens and apostrophes. */
export function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/^[^a-z']+/, '')
    .replace(/[^a-z']+$/, '')
    .replace(/'s$/, '')
}

export function isLookupable(raw: string): boolean {
  const word = normalizeWord(raw)
  return word.length > 1 && /[a-z]/.test(word)
}

// --- Sense selection --------------------------------------------------------

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'as', 'at', 'by', 'from', 'that', 'this', 'these', 'those', 'it', 'its',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had',
  'not', 'no', 'so', 'than', 'then', 'they', 'their', 'them', 'he', 'she',
  'his', 'her', 'we', 'our', 'you', 'your', 'i', 'my', 'who', 'which', 'what',
  'when', 'where', 'while', 'also', 'more', 'most', 'such', 'can', 'could',
  'would', 'will', 'may', 'might', 'one', 'other', 'into', 'out', 'up',
  'after', 'before', 'over', 'under', 'through', 'during', 'between',
  'against', 'without', 'within', 'about', 'across', 'along', 'since',
  'until', 'upon', 'near', 'per', 'because', 'though', 'although',
])

const DETERMINERS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'its', 'his', 'her',
  'their', 'our', 'my', 'your', 'each', 'every', 'another', 'some', 'any',
  'no', 'both', 'such',
])

const DEGREE_WORDS = new Set([
  'very', 'quite', 'rather', 'somewhat', 'deeply', 'highly', 'utterly',
  'especially', 'particularly', 'too', 'less', 'least', 'so',
])

const COPULAS = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'being', 'seems', 'seemed'])

const AUXILIARIES = new Set([
  'to', 'will', 'would', 'can', 'could', 'may', 'might', 'must', 'should',
  'has', 'have', 'had', 'did', 'does', 'do',
  'they', 'we', 'he', 'she', 'it', 'i', 'you',
])

// Senses the SAT will never be testing, and that only confuse a learner.
const DEPRECATED_LABEL = /^\(?\s*(archaic|obsolete|dated|rare|dialect|slang|vulgar|historical)\b/i

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
}

/** Rough stem so "argued"/"arguing" still match "argue" in a definition. */
function stem(word: string): string {
  return word
    .replace(/(ies)$/, 'y')
    .replace(/(ing|ed|es|s|ly)$/, '')
}

/** A word that could head a noun phrase, as opposed to a function word. */
function isContentToken(token: string | null): boolean {
  return Boolean(token) && !STOP_WORDS.has(token as string) && /^[a-z][a-z'-]*$/.test(token as string)
}

/** "burns", "scratched", "reading" — something the target could modify after. */
function looksVerbal(token: string): boolean {
  return token.length > 3 && /(ed|es|s|ing)$/.test(token) && !STOP_WORDS.has(token)
}

/**
 * What role does the word play in this sentence? Only the cues that are cheap
 * and reliable: what sits immediately before it, whether a noun follows it, and
 * the suffix as a last resort. Enough to keep "she tempered her criticism" off
 * the noun sense and "burns delicate patterns" off the lingerie one.
 */
export function guessPartOfSpeech(sentence: string, word: string): string | null {
  const tokens = sentence.toLowerCase().split(/[^a-z'-]+/).filter(Boolean)
  const target = normalizeWord(word)
  const index = tokens.indexOf(target)
  const previous = index > 0 ? tokens[index - 1] : null
  const twoBack = index > 1 ? tokens[index - 2] : null
  const next = index >= 0 && index + 1 < tokens.length ? tokens[index + 1] : null

  if (previous && DEGREE_WORDS.has(previous)) {
    return target.endsWith('ly') ? 'adverb' : 'adjective'
  }
  if (previous && COPULAS.has(previous)) {
    // "was ambivalent" is a description; "was arguing" is an action.
    return target.endsWith('ing') ? 'verb' : 'adjective'
  }
  if (previous && AUXILIARIES.has(previous)) return 'verb'
  if (previous && DETERMINERS.has(previous)) {
    // "a delicate item" — a noun follows, so the target modifies it. With
    // nothing after it ("he lost his temper"), the target is the noun.
    return isContentToken(next) ? 'adjective' : 'noun'
  }
  // A past form with no determiner in front of it is the sentence's verb:
  // "the critic tempered her judgement".
  if (/ed$/.test(target) && target.length > 4) return 'verb'
  // "a wide following after its release" — the determiner is two back, so the
  // target closes the noun phrase unless yet another noun follows it.
  if (twoBack && DETERMINERS.has(twoBack) && isContentToken(previous)) {
    return isContentToken(next) ? 'adjective' : 'noun'
  }
  // "burns delicate patterns" — wedged between a verb and its object.
  if (previous && looksVerbal(previous) && isContentToken(next)) return 'adjective'

  if (target.endsWith('ly')) return 'adverb'
  if (/(tion|ment|ness|ity|ance|ence|ism|ship)$/.test(target)) return 'noun'
  if (/(ous|ful|ive|able|ible|ic|al|ent|ant)$/.test(target)) return 'adjective'
  return null
}

function scoreSense(
  sense: WordSense,
  index: number,
  sentenceStems: Set<string>,
  preferredPos: string | null,
): number {
  let score = 0

  const senseText = `${sense.definition} ${sense.example ?? ''}`
  const overlap = new Set(contentWords(senseText).map(stem))
  overlap.forEach((token) => {
    if (sentenceStems.has(token)) score += 3
  })

  // Dictionary order tracks how common a sense is, but it is a weaker signal
  // than the sentence itself: a small, decaying nudge that context can outvote.
  score += Math.max(0, 3 - index)
  if (preferredPos && sense.partOfSpeech === preferredPos) score += 5
  if (DEPRECATED_LABEL.test(sense.definition)) score -= 12
  // "(in combination) …", "Of, or pertaining to, the Apocrypha." — usage labels
  // and cross-references to a proper noun teach a learner nothing on their own.
  if (/^\(/.test(sense.definition)) score -= 3
  if (/^of,? or pertaining to\b/i.test(sense.definition)) score -= 5
  // Short and plain beats long and technical for a popup read mid-passage.
  if (sense.definition.length <= 90) score += 2
  else if (sense.definition.length > 200) score -= 2

  return score
}

/** The sense that best fits the sentence the word was read in. */
export function pickSense(
  senses: WordSense[],
  sentence: string,
  word: string,
): WordSense | null {
  if (senses.length === 0) return null
  const sentenceStems = new Set(
    contentWords(sentence)
      .filter((token) => token !== normalizeWord(word))
      .map(stem),
  )
  const preferredPos = guessPartOfSpeech(sentence, word)

  let best = senses[0]
  let bestScore = -Infinity
  senses.forEach((sense, index) => {
    const score = scoreSense(sense, index, sentenceStems, preferredPos)
    if (score > bestScore) {
      best = sense
      bestScore = score
    }
  })
  return best
}

/** Senses other than the chosen one, deduped, for the "more senses" list. */
export function otherSenses(senses: WordSense[], chosen: WordSense | null): WordSense[] {
  const seen = new Set(chosen ? [chosen.definition] : [])
  return senses.filter((sense) => {
    if (seen.has(sense.definition)) return false
    seen.add(sense.definition)
    return true
  })
}

// --- Response parsing -------------------------------------------------------

function plainDefinition(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text.length <= MAX_DEFINITION_CHARS) return text
  const cut = text.slice(0, MAX_DEFINITION_CHARS)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : MAX_DEFINITION_CHARS).trim()}…`
}

type ApiEntry = {
  word?: unknown
  meanings?: Array<{
    partOfSpeech?: unknown
    definitions?: Array<{ definition?: unknown; example?: unknown }>
  }>
}

export function parseEntries(payload: unknown): WordSense[] {
  if (!Array.isArray(payload)) return []
  const senses: WordSense[] = []

  for (const entry of payload as ApiEntry[]) {
    for (const meaning of entry?.meanings ?? []) {
      const partOfSpeech =
        typeof meaning?.partOfSpeech === 'string' ? meaning.partOfSpeech : 'word'
      for (const definition of meaning?.definitions ?? []) {
        if (typeof definition?.definition !== 'string') continue
        const text = definition.definition.trim()
        if (!text) continue
        senses.push({
          partOfSpeech,
          definition: plainDefinition(text),
          example: typeof definition.example === 'string' ? definition.example : null,
        })
      }
    }
  }

  return senses
}

// --- Baked dictionary -------------------------------------------------------
// One download covers every word in the passages. Senses arrive as tuples
// ([partOfSpeech, definition, example?]) to keep the file small, and a null
// entry records a word Merriam-Webster does not carry - worth remembering, so
// the fallback is not asked about it either.

type PackedSense = [string, string, string?]
type PackedEntry = { s?: PackedSense[]; f?: number; r?: string } | null

export type BakedDictionary = {
  version?: number
  words?: Record<string, PackedEntry>
}

let bakedIndex: Map<string, LookupResult> | null = null
let bakedLoad: Promise<Map<string, LookupResult>> | null = null

export function parseBaked(payload: unknown): Map<string, LookupResult> {
  const index = new Map<string, LookupResult>()
  const words = (payload as BakedDictionary)?.words
  if (!words || typeof words !== 'object') return index

  for (const [word, entry] of Object.entries(words)) {
    const packed = entry?.s
    if (!Array.isArray(packed) || packed.length === 0) {
      index.set(word, { status: 'missing', word })
      continue
    }
    const senses = packed
      .filter((sense) => Array.isArray(sense) && typeof sense[1] === 'string')
      .map((sense) => ({
        partOfSpeech: typeof sense[0] === 'string' ? sense[0] : 'word',
        definition: sense[1],
        example: typeof sense[2] === 'string' ? sense[2] : null,
      }))
    index.set(word, senses.length > 0 ? { status: 'found', word, senses } : { status: 'missing', word })
  }
  return index
}

/**
 * Fetches the baked dictionary once per session. A failure is not fatal: the
 * index stays empty and every tap takes the live fallback instead.
 */
export function preloadDictionary(fetchImpl?: typeof fetch): Promise<Map<string, LookupResult>> {
  if (bakedLoad) return bakedLoad
  bakedLoad = (async () => {
    try {
      const doFetch = fetchImpl ?? fetch
      const response = await doFetch(assetPath(BAKED_PATH))
      if (!response.ok) throw new Error(`Dictionary file responded ${response.status}`)
      bakedIndex = parseBaked(await response.json())
    } catch {
      bakedIndex = new Map()
    }
    return bakedIndex
  })()
  return bakedLoad
}

/** How many words the baked file carries. Exposed for tests and diagnostics. */
export function bakedWordCount(): number {
  return bakedIndex?.size ?? 0
}

// --- Cache ------------------------------------------------------------------
// Two layers: a module Map for the current session, and localStorage so a word
// looked up during module 1 is still free tomorrow. Misses are cached too - a
// name the dictionary does not carry shouldn't be re-fetched on every tap.

const memoryCache = new Map<string, LookupResult>()
const inFlight = new Map<string, Promise<LookupResult>>()

function readStoredCache(): Record<string, CacheRecord> {
  if (typeof localStorage === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, CacheRecord>
  } catch {
    return {}
  }
}

function writeStoredCache(word: string, result: LookupResult, at: number): void {
  if (typeof localStorage === 'undefined') return
  const stored = readStoredCache()
  stored[word] = { result, cachedAt: at }

  const words = Object.keys(stored)
  if (words.length > CACHE_LIMIT) {
    words
      .sort((a, b) => (stored[a].cachedAt ?? 0) - (stored[b].cachedAt ?? 0))
      .slice(0, words.length - CACHE_LIMIT)
      .forEach((key) => delete stored[key])
  }

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stored))
  } catch {
    // A full quota costs speed, never correctness.
  }
}

/**
 * An answer available without waiting: the session map, the baked dictionary if
 * it has finished downloading, then localStorage. Lets the popup open with the
 * definition already in it rather than flashing a spinner.
 */
export function cachedLookup(raw: string, now = Date.now()): LookupResult | null {
  const word = normalizeWord(raw)
  const inMemory = memoryCache.get(word)
  if (inMemory) return inMemory

  const baked = bakedIndex?.get(word)
  if (baked) return baked

  const record = readStoredCache()[word]
  if (!record || now - record.cachedAt > CACHE_TTL_MS) return null
  memoryCache.set(word, record.result)
  return record.result
}

export function clearDictionaryCache(): void {
  memoryCache.clear()
  inFlight.clear()
  bakedIndex = null
  bakedLoad = null
  if (typeof localStorage !== 'undefined') localStorage.removeItem(CACHE_KEY)
}

// --- Lookup -----------------------------------------------------------------

type LookupOptions = {
  fetchImpl?: typeof fetch
  now?: () => number
  signal?: AbortSignal
}

/**
 * Definitions for a word. Reads the baked Merriam-Webster file first and only
 * falls back to the live service for words it does not carry; concurrent taps
 * on the same word share one request. Rejects only when the network itself
 * fails, so the popup can tell "no entry" apart from "you are offline".
 */
export async function lookupWord(
  raw: string,
  { fetchImpl, now = Date.now, signal }: LookupOptions = {},
): Promise<LookupResult> {
  const word = normalizeWord(raw)
  if (!word) return { status: 'missing', word: raw }

  const cached = cachedLookup(word, now())
  if (cached) return cached

  const pending = inFlight.get(word)
  if (pending) return pending

  const request = (async (): Promise<LookupResult> => {
    // Not given `fetchImpl`: the baked file is one shared download for the
    // whole session, independent of whatever stub a caller passed for the
    // fallback service.
    const baked = (await preloadDictionary()).get(word)
    if (baked) return baked

    const doFetch = fetchImpl ?? fetch
    const response = await doFetch(`${API_BASE}/${encodeURIComponent(word)}`, { signal })

    let result: LookupResult
    if (response.status === 404) {
      result = { status: 'missing', word }
    } else if (!response.ok) {
      throw new Error(`Dictionary request failed (${response.status})`)
    } else {
      const senses = parseEntries(await response.json())
      result = senses.length > 0 ? { status: 'found', word, senses } : { status: 'missing', word }
    }

    memoryCache.set(word, result)
    writeStoredCache(word, result, now())
    return result
  })()
    .finally(() => inFlight.delete(word))

  inFlight.set(word, request)
  return request
}
