import type { Question } from '../types.ts'

export type ChoiceLetter = 'A' | 'B' | 'C' | 'D'

// A choice as shown to the student. `displayLetter` is its position label (A–D
// top to bottom); `sourceLetter` is the underlying key in question.choices.
// When a question resurfaces we shuffle, so the same correct answer no longer
// sits at the same letter — the student can't pattern-match "it was C."
export type ChoiceSlot = {
  displayLetter: ChoiceLetter
  sourceLetter: ChoiceLetter
  text: string
}

const LETTERS: ChoiceLetter[] = ['A', 'B', 'C', 'D']

function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    const j = (h >>> 0) % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Presentation order for a question's choices. `shuffle` is off for a first
// encounter (identity A→A…) and on for a resurfaced one, using `seed` so the
// same resurfacing renders stably across reloads.
export function orderedChoices(
  question: Question,
  shuffle: boolean,
  seed = question.id,
): ChoiceSlot[] {
  const sources = shuffle ? seededShuffle(LETTERS, seed) : LETTERS
  return sources.map((sourceLetter, index) => ({
    displayLetter: LETTERS[index],
    sourceLetter,
    text: question.choices[sourceLetter],
  }))
}
