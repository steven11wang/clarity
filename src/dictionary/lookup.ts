// Tapping a word in a passage asks what it means, and the answer is cached so
// the second tap (and the next session) is instant.
//
// Definitions come from Merriam-Webster's Learner's Dictionary, baked into
// /data/dictionary.json at build time by tools/build-dictionary.mjs. Baking
// rather than calling the API keeps the key off a static site, survives an
// outage mid-exam, and costs one cached download instead of a request per tap.
// Words outside the passage corpus - or not yet baked, since the free tier is
// metered per day - fall back to Wiktionary's REST view, which needs no key.
// (dictionaryapi.dev filled that slot until August 2026, when its origin began
// answering anything its edge cache had not already seen with a twenty-second
// hang and then a 522. It is itself a view onto the same Wiktionary data.)
//
// Either source answers with every sense of the word, so the work here is
// picking the one that fits the sentence the learner is actually reading.

import { assetPath } from '../lib/assetPath.ts'

const WIKTIONARY_BASE = 'https://en.wiktionary.org/api/rest_v1/page/definition'
const BAKED_PATH = '/data/dictionary.json'
const CACHE_KEY = 'clarity:v1:dictionary-cache'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const CACHE_LIMIT = 400
const MAX_DEFINITION_CHARS = 180
// Long enough for a slow phone connection, short enough that a dead service is
// reported rather than waited out.
const LIVE_TIMEOUT_MS = 6000

export type WordSense = {
  partOfSpeech: string
  definition: string
  example: string | null
  /** Near-synonyms for this part of speech, commonest first. Only the live
   *  fallback carries these today - baked Merriam-Webster entries don't, since
   *  that needs a separate Thesaurus key nothing here has yet. */
  synonyms?: string[]
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

/**
 * Base forms worth trying when the word itself has no entry. A dictionary
 * carries "portrayal", not "portrayals", and the baked file is built from
 * whichever form the passages happened to use - so an inflected tap has to be
 * able to walk back to its lemma before anyone touches the network.
 *
 * Deliberately over-generous: a wrong guess costs a miss on a word that was
 * already missing, and the candidates are only ever checked, never trusted.
 */
export function wordVariants(raw: string): string[] {
  const word = normalizeWord(raw)
  const out: string[] = []
  const add = (candidate: string) => {
    if (candidate.length > 2 && candidate !== word && !out.includes(candidate)) out.push(candidate)
  }

  if (word.endsWith('ies')) add(`${word.slice(0, -3)}y`)
  if (word.endsWith('ied')) add(`${word.slice(0, -3)}y`)
  if (word.endsWith('es')) {
    add(word.slice(0, -1))
    add(word.slice(0, -2))
  }
  if (word.endsWith('s') && !word.endsWith('ss')) add(word.slice(0, -1))
  if (word.endsWith('ed')) {
    add(word.slice(0, -1))
    add(word.slice(0, -2))
    if (/(.)\1ed$/.test(word)) add(word.slice(0, -3))
  }
  if (word.endsWith('ing')) {
    if (/(.)\1ing$/.test(word)) add(word.slice(0, -4))
    add(word.slice(0, -3))
    add(`${word.slice(0, -3)}e`)
  }
  if (word.endsWith('ly')) add(word.slice(0, -2))
  if (word.endsWith('est')) add(word.slice(0, -3))
  if (word.endsWith('er')) add(word.slice(0, -2))

  return out
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
  // than the sentence itself: context can outvote it when keywords match.
  score += Math.max(0, 6 - index * 2)
  if (preferredPos && sense.partOfSpeech === preferredPos) score += 5
  if (DEPRECATED_LABEL.test(sense.definition)) score -= 12
  // "(in combination) …", "Of, or pertaining to, the Apocrypha." — usage labels
  // and cross-references to a proper noun teach a learner nothing on their own.
  if (/^\(/.test(sense.definition)) score -= 3
  if (/^of,? or pertaining to\b/i.test(sense.definition)) score -= 5
  // Short and plain beats long and technical for a popup read mid-passage,
  // but ultra-short entries (<35 chars) are often archaic fragments.
  if (sense.definition.length >= 35 && sense.definition.length <= 140) score += 1
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

// Wiktionary answers an inflected form with "plural of portrayal" and nothing
// else, which teaches a learner reading mid-passage nothing. Those senses are
// dropped, and the walk back to the lemma is left to wordVariants.
const FORM_OF = /^(?:plural|past tense|past participle|present participle|simple past|gerund|comparative|superlative|third-person singular|inflection|alternative (?:form|spelling))\b/i

function stripMarkup(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    // Stripping the link around "portraying" must not leave "portraying ."
    .replace(/\s+([,;:.!?])/g, '$1')
    .trim()
}

type WiktionaryPayload = {
  en?: Array<{
    partOfSpeech?: unknown
    definitions?: Array<{ definition?: unknown; examples?: unknown }>
  }>
}

/** Wiktionary's REST view: HTML fragments grouped by part of speech. */
export function parseWiktionary(payload: unknown): WordSense[] {
  const groups = (payload as WiktionaryPayload)?.en
  if (!Array.isArray(groups)) return []
  const senses: WordSense[] = []

  for (const group of groups) {
    const partOfSpeech =
      typeof group?.partOfSpeech === 'string' ? group.partOfSpeech.toLowerCase() : 'word'
    for (const entry of group?.definitions ?? []) {
      if (typeof entry?.definition !== 'string') continue
      const text = stripMarkup(entry.definition)
      if (!text || FORM_OF.test(text)) continue
      const rawExample = Array.isArray(entry.examples) ? entry.examples[0] : null
      const example = typeof rawExample === 'string' ? stripMarkup(rawExample) : ''
      senses.push({
        partOfSpeech,
        definition: plainDefinition(text),
        example: example || null,
      })
    }
  }

  return senses
}

// --- Baked dictionary -------------------------------------------------------
// One download covers every word in the passages. Senses arrive as tuples
// ([partOfSpeech, definition, example?]) to keep the file small, and a null
// entry records a word Merriam-Webster does not carry - worth remembering, so
// the fallback is not asked about it either. `y` is thesaurus synonyms, one
// list per part of speech - a separate MW product bakeable independently of
// `s`, so an entry can have one without the other.

type PackedSense = [string, string, string?]
type PackedEntry = { s?: PackedSense[]; f?: number; r?: string; y?: Record<string, string[]> } | null

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
    const synonymsByPos = entry?.y
    const senses = packed
      .filter((sense) => Array.isArray(sense) && typeof sense[1] === 'string')
      .map((sense) => {
        const partOfSpeech = typeof sense[0] === 'string' ? sense[0] : 'word'
        const synonyms = synonymsByPos?.[partOfSpeech]
        return {
          partOfSpeech,
          definition: sense[1],
          example: typeof sense[2] === 'string' ? sense[2] : null,
          ...(synonyms && synonyms.length > 0 ? { synonyms } : {}),
        }
      })
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
function cachedExact(word: string, now: number): LookupResult | null {
  const inMemory = memoryCache.get(word)
  if (inMemory) return inMemory

  const baked = bakedIndex?.get(word)
  if (baked) return baked

  const record = readStoredCache()[word]
  if (!record || now - record.cachedAt > CACHE_TTL_MS) return null
  memoryCache.set(word, record.result)
  return record.result
}

export function cachedLookup(raw: string, now = Date.now()): LookupResult | null {
  const word = normalizeWord(raw)
  const direct = cachedExact(word, now)
  if (direct?.status === 'found') return direct

  // "portrayals" has no entry of its own; "portrayal" is already on this
  // machine. Answering from the lemma beats a network round trip - and beats
  // the shrug the exact word would otherwise get.
  for (const variant of wordVariants(word)) {
    const alternate = cachedExact(variant, now)
    if (alternate?.status === 'found') return alternate
  }

  return direct
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
  /** How long the live fallback gets before it counts as down. Tests shorten it. */
  timeoutMs?: number
}

/**
 * The live fallback is a free service with no uptime guarantee, and its
 * outages present as a request that hangs for twenty seconds before a 522
 * rather than as a refusal. Cut it off early: a learner mid-passage is better
 * served by a quick "try again" than by a spinner that outlives their patience.
 */
async function fetchWithDeadline(
  doFetch: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await doFetch(url, { signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Dictionary request timed out')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

// Enough to cover a plural or a past tense without turning one tap into a
// fistful of requests.
const MAX_LIVE_VARIANTS = 2

/**
 * Asks the live service for a word and for the lemmas it could be an
 * inflection of. A 404 is an answer - that form has no entry - so the next
 * candidate is tried; only a request nobody could complete rejects, which is
 * what lets the popup tell "no such word" apart from "you are offline".
 */
async function liveSenses(
  candidates: string[],
  doFetch: typeof fetch,
  timeoutMs: number,
): Promise<WordSense[]> {
  let failure: unknown = null

  for (const candidate of candidates) {
    try {
      const url = `${WIKTIONARY_BASE}/${encodeURIComponent(candidate)}`
      const response = await fetchWithDeadline(doFetch, url, timeoutMs)
      if (response.status === 404) continue
      if (!response.ok) {
        failure = new Error(`Dictionary request failed (${response.status})`)
        continue
      }
      const senses = parseWiktionary(await response.json())
      if (senses.length > 0) return senses
    } catch (error) {
      // Down, not merely lacking this word: asking it about the rest of the
      // candidates would only spend the learner's patience.
      failure = error
      break
    }
  }

  if (failure) throw failure
  return []
}

/**
 * Definitions for a word. Reads the baked Merriam-Webster file first and only
 * falls back to the live service for words it does not carry; concurrent taps
 * on the same word share one request. Rejects only when the network itself
 * fails, so the popup can tell "no entry" apart from "you are offline".
 */
export async function lookupWord(
  raw: string,
  { fetchImpl, now = Date.now, timeoutMs = LIVE_TIMEOUT_MS }: LookupOptions = {},
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
    const index = await preloadDictionary()
    const baked = index.get(word)
    if (baked?.status === 'found') return baked
    for (const variant of wordVariants(word)) {
      const alternate = index.get(variant)
      if (alternate?.status === 'found') return alternate
    }

    const doFetch = fetchImpl ?? fetch
    // Same lemma walk as the cache, one service out. Wiktionary titles are
    // case-sensitive, so a name like "Sullivan" only answers to its capital -
    // asked last, since the common noun is the likelier reading.
    const candidates = [word, ...wordVariants(word).slice(0, MAX_LIVE_VARIANTS)]
    if (/^[A-Z]/.test(raw.trim())) candidates.push(word[0].toUpperCase() + word.slice(1))
    const senses = await liveSenses(candidates, doFetch, timeoutMs)

    const result: LookupResult =
      senses.length > 0 ? { status: 'found', word, senses } : { status: 'missing', word }

    memoryCache.set(word, result)
    writeStoredCache(word, result, now())
    return result
  })()
    .finally(() => inFlight.delete(word))

  inFlight.set(word, request)
  return request
}
