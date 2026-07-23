import { segmentSentences } from '../components/Passage/sentence.ts'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

// Evidence in Clarity is self-graded (SAT rationales quote the passage only ~9%
// of the time, and grammar skills have no single evidence sentence). But when a
// rationale *does* quote the passage, we can point at the exact sentence(s) it
// leans on — a reinforcement shown AFTER the student has committed and
// self-graded, never as the scoring mechanism. Returns passage sentence indices
// the rationale quotes, or [] when it quotes nothing matchable.
export function findReferencedSentences(passage: string, rationale: string): number[] {
  const quotes = [...rationale.matchAll(/[“”"]([^“”"]{15,})[”“"]/g)].map((m) => m[1])
  if (quotes.length === 0) return []

  const sentences = segmentSentences(passage).map(normalize)
  const hits = new Set<number>()
  for (const quote of quotes) {
    const needle = normalize(quote)
    if (needle.length < 15) continue
    sentences.forEach((sentence, index) => {
      if (sentence.includes(needle) || (needle.length > 25 && needle.includes(sentence))) {
        hits.add(index)
      }
    })
  }
  return [...hits].sort((a, b) => a - b)
}
