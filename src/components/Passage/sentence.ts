// Common abbreviations whose trailing period must not end a sentence. Kept
// small and focused on what shows up in SAT passages (author initials, titles,
// citation shorthands).
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'jr', 'sr', 'vs', 'etc', 'no',
  'fig', 'al', 'ca', 'ed', 'trans', 'vol', 'pp',
])

// Stand-in for a period that is not a sentence boundary; swapped back after
// splitting. Uses a private-use codepoint that won't appear in real text.
const DOT = ''

// Neutralize periods that are not real sentence boundaries (single-letter
// initials like "A.", known abbreviations, decimals) so naive splitting doesn't
// break mid-sentence — e.g. "translated by A. Christina Albers".
function protect(text: string): string {
  return text
    .replace(/\b([A-Z])\.(?=\s)/g, `$1${DOT}`)
    .replace(/(\d)\.(?=\d)/g, `$1${DOT}`)
    .replace(/\b([A-Za-z]+)\./g, (match, word: string) =>
      ABBREVIATIONS.has(word.toLowerCase()) ? `${word}${DOT}` : match,
    )
}

export function segmentSentences(passage: string): string[] {
  const pieces = protect(passage).match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []
  return pieces
    .map((sentence) => sentence.replaceAll(DOT, '.').trim())
    .filter(Boolean)
}
