// Merriam-Webster's API answers in its own print-markup dialect: senses nested
// several arrays deep, and definition text peppered with tokens like `{bc}` and
// `{sx|composure||}`. This module flattens one API response into the plain
// WordSense list the popup renders.
//
// Only the build tool (tools/build-dictionary.mjs) calls this - the app reads
// the baked JSON and never holds an API key. It lives in src/ so the parser and
// its tests sit next to the rest of the dictionary code.

import type { WordSense } from './lookup.ts'

/** Senses the SAT will never test, and that only confuse a learner. */
const SKIPPED_LABELS = /^(archaic|obsolete|dated|dialect|slang|vulgar|nonstandard)\b/i

// --- Markup -----------------------------------------------------------------

/**
 * `{it}temper{/it}` -> `temper`, `{sx|composure||}` -> `composure`, and
 * cross-reference blocks like `{dx}see also …{/dx}` drop out entirely.
 */
export function stripMarkup(raw: string): string {
  return raw
    // Whole blocks that are pointers to other entries, not meaning.
    .replace(/\{dx(?:_def|_ety)?\}.*?\{\/dx(?:_def|_ety)?\}/g, '')
    .replace(/\{ma\}.*?\{\/ma\}/g, '')
    // Pipe-delimited links: the display text wins, else the target word.
    .replace(/\{(?:sx|dxt|a_link|d_link|i_link|et_link|mat|dx_t)\|([^|}]*)\|?([^|}]*)\|?([^}]*)\}/g,
      (_all, word: string, _id: string, text: string) => text || word)
    // A bold colon separates a sense number from its definition.
    .replace(/\{bc\}/g, ': ')
    .replace(/\{ldquo\}/g, '“')
    .replace(/\{rdquo\}/g, '”')
    // Everything left is a formatting wrapper around text worth keeping.
    .replace(/\{\/?[a-z_]+\}/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,]+/, '')
    .replace(/\s+([.,;:])/g, '$1')
    .trim()
}

/** "He {it}tempered{/it} his criticism." -> plain sentence, or null if empty. */
function cleanExample(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = stripMarkup(raw)
  // MW glosses some illustrations inline: "…flared [=people became angry]".
  const withoutGloss = text.replace(/\s*\[=[^\]]*\]/g, '').trim()
  return withoutGloss.length > 3 ? withoutGloss : null
}

// --- Sense tree -------------------------------------------------------------

type Labelled = { sls?: unknown }

function hasSkippedLabel(node: Labelled): boolean {
  const labels = Array.isArray(node.sls) ? node.sls : []
  return labels.some((label) => typeof label === 'string' && SKIPPED_LABELS.test(label))
}

/** The defining text and first illustration of one `dt` block. */
function readDefiningText(dt: unknown): { definition: string; example: string | null } {
  let definition = ''
  let example: string | null = null
  if (!Array.isArray(dt)) return { definition, example }

  for (const item of dt) {
    if (!Array.isArray(item)) continue
    const [kind, value] = item as [unknown, unknown]
    if (kind === 'text' && typeof value === 'string' && !definition) {
      definition = stripMarkup(value)
    } else if (kind === 'vis' && Array.isArray(value) && !example) {
      for (const illustration of value) {
        example = cleanExample((illustration as { t?: unknown })?.t)
        if (example) break
      }
    } else if (kind === 'uns' && Array.isArray(value) && !example) {
      // A usage note carries its own illustrations one level down.
      for (const note of value) {
        const found = readDefiningText(note)
        if (found.example) {
          example = found.example
          break
        }
      }
    }
  }

  return { definition, example }
}

/** Walks `sseq`, which nests senses inside sequences inside groups. */
function collectSenses(node: unknown, partOfSpeech: string, out: WordSense[]): void {
  if (!Array.isArray(node)) {
    // `def` is a list of sense blocks, each wrapping its sequence in `sseq`.
    const block = node as { sseq?: unknown } | null
    if (block && typeof block === 'object' && block.sseq) {
      collectSenses(block.sseq, partOfSpeech, out)
    }
    return
  }

  // A tagged pair: ['sense', {...}], ['pseq', [...]], ['bs', {...}].
  const [tag, body] = node as [unknown, unknown]
  if (typeof tag === 'string') {
    if (tag === 'sense' || tag === 'sen') {
      const sense = body as Labelled & { dt?: unknown; sdsense?: { dt?: unknown } }
      if (hasSkippedLabel(sense)) return
      const main = readDefiningText(sense.dt)
      if (main.definition) {
        out.push({ partOfSpeech, definition: main.definition, example: main.example })
      }
      // "2 a … b" - a divided sense hanging off the same entry.
      if (sense.sdsense) {
        const divided = readDefiningText(sense.sdsense.dt)
        if (divided.definition) {
          out.push({ partOfSpeech, definition: divided.definition, example: divided.example })
        }
      }
      return
    }
    if (tag === 'pseq' || tag === 'bs') {
      collectSenses(body, partOfSpeech, out)
      return
    }
  }

  for (const child of node) collectSenses(child, partOfSpeech, out)
}

// --- Entries ----------------------------------------------------------------

type Entry = {
  meta?: { id?: unknown; stems?: unknown }
  fl?: unknown
  shortdef?: unknown
  def?: unknown
}

/** 'temper:2' -> 'temper'. */
function headword(entry: Entry): string {
  const id = typeof entry.meta?.id === 'string' ? entry.meta.id : ''
  return id.split(':')[0].toLowerCase()
}

/**
 * True when the entry actually answers the word asked about. MW resolves
 * inflections, so a lookup of "tempered" comes back under "temper" with the
 * queried form listed in `meta.stems` - but a lookup can also return a
 * near-miss entry that belongs to a different word entirely.
 */
export function entryMatches(entry: unknown, word: string): boolean {
  const typed = entry as Entry
  if (!typed || typeof typed !== 'object') return false
  const target = word.toLowerCase()
  if (headword(typed) === target) return true
  const stems = Array.isArray(typed.meta?.stems) ? typed.meta.stems : []
  return stems.some((stem) => typeof stem === 'string' && stem.toLowerCase() === target)
}

/**
 * True when the payload is MW's "no such word" answer: it responds with an
 * array of spelling suggestions (or nothing at all) rather than entries.
 */
export function isMissPayload(payload: unknown): boolean {
  if (!Array.isArray(payload)) return true
  if (payload.length === 0) return true
  return payload.every((item) => typeof item === 'string')
}

/**
 * Every sense MW holds for `word`, in the order the dictionary lists them -
 * which already runs commonest-first, so pickSense only has to overrule it when
 * the sentence disagrees.
 */
export function parseMerriamWebster(payload: unknown, word: string): WordSense[] {
  if (isMissPayload(payload)) return []
  const senses: WordSense[] = []

  for (const raw of payload as Entry[]) {
    if (!entryMatches(raw, word)) continue
    const partOfSpeech = typeof raw.fl === 'string' ? raw.fl : 'word'

    const before = senses.length
    collectSenses(raw.def, partOfSpeech, senses)

    // An entry with no walkable `def` (a cross-reference, or an undefined
    // run-on) still carries MW's own one-line summaries.
    if (senses.length === before && Array.isArray(raw.shortdef)) {
      for (const short of raw.shortdef) {
        if (typeof short !== 'string') continue
        const definition = stripMarkup(short)
        if (definition) senses.push({ partOfSpeech, definition, example: null })
      }
    }
  }

  // MW repeats a sense across homographs often enough to be worth deduping.
  const seen = new Set<string>()
  return senses.filter((sense) => {
    const key = `${sense.partOfSpeech}|${sense.definition}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// --- Thesaurus ----------------------------------------------------------------
// MW's Thesaurus API answers with the same entry shape as the dictionaries
// above, plus `meta.syns`: near-synonyms grouped into relevance-ranked
// clusters, one cluster per numbered sense. The popup shows one synonym list
// per part of speech rather than per sense - so every cluster for a part of
// speech is flattened together here, same as parseEntries does for the free
// live fallback.

// Matches the length of MW's own "Synonyms of ___" panel closely enough.
const MAX_THESAURUS_SYNONYMS = 8

/**
 * `word`'s near-synonyms, keyed by part of speech. A part of speech missing
 * from the result is one MW's thesaurus does not cover for this word - not
 * the same as an empty list, so callers can tell "none" from "not asked yet".
 */
export function parseThesaurusSynonyms(payload: unknown, word: string): Record<string, string[]> {
  if (isMissPayload(payload)) return {}
  const byPos: Record<string, string[]> = {}

  for (const raw of payload as Entry[]) {
    if (!entryMatches(raw, word)) continue
    const partOfSpeech = typeof raw.fl === 'string' ? raw.fl : 'word'
    const clusters = (raw as { meta?: { syns?: unknown } }).meta?.syns
    if (!Array.isArray(clusters)) continue

    const list = byPos[partOfSpeech] ?? []
    const seen = new Set(list.map((existing) => existing.toLowerCase()))
    for (const cluster of clusters) {
      if (!Array.isArray(cluster)) continue
      for (const item of cluster) {
        if (typeof item !== 'string') continue
        const clean = item.trim()
        if (!clean || seen.has(clean.toLowerCase())) continue
        seen.add(clean.toLowerCase())
        list.push(clean)
      }
    }
    byPos[partOfSpeech] = list
  }

  for (const partOfSpeech of Object.keys(byPos)) {
    if (byPos[partOfSpeech].length === 0) delete byPos[partOfSpeech]
    else byPos[partOfSpeech] = byPos[partOfSpeech].slice(0, MAX_THESAURUS_SYNONYMS)
  }
  return byPos
}
