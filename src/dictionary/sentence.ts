// The popup promises a definition that "fits the sentence", and the word bank
// stores the sentence the word was met in. Both need the one sentence around a
// character offset — not the whole paragraph.

type Span = { start: number; end: number }

// A sentence runs to the first .!? that is followed by whitespace (or the end
// of the text). Closing quotes and brackets stay with the sentence they end.
// Common abbreviations are stitched back on so "Dr. Chen argued" stays whole.
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'jr', 'sr', 'vs', 'etc', 'e.g', 'i.e',
  'fig', 'no', 'approx', 'ca', 'cf',
])

function endsOnAbbreviation(text: string, dotIndex: number): boolean {
  const before = text.slice(0, dotIndex)
  const word = before.split(/[\s(“"']+/).pop() ?? ''
  return ABBREVIATIONS.has(word.toLowerCase())
}

export function sentenceSpans(text: string): Span[] {
  const spans: Span[] = []
  let start = 0

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char !== '.' && char !== '!' && char !== '?') continue
    if (char === '.' && endsOnAbbreviation(text, index)) continue

    let end = index + 1
    while (end < text.length && /["'”’)\]]/.test(text[end])) end += 1
    // A run of terminators ("?!") closes once.
    while (end < text.length && /[.!?]/.test(text[end])) end += 1
    if (end < text.length && !/\s/.test(text[end])) continue

    spans.push({ start, end })
    while (end < text.length && /\s/.test(text[end])) end += 1
    start = end
    index = end - 1
  }

  if (start < text.length) spans.push({ start, end: text.length })
  return spans
}

/** The sentence containing `offset`, trimmed. Falls back to the whole text. */
export function sentenceAt(text: string, offset: number): string {
  const spans = sentenceSpans(text)
  const span =
    spans.find((entry) => offset >= entry.start && offset < entry.end) ??
    spans[spans.length - 1]
  if (!span) return text.trim()
  return text.slice(span.start, span.end).trim()
}
