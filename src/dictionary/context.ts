import { sentenceAt } from './sentence.ts'

export type ResolveChoiceContextParams = {
  /** The text of the choice or token being looked up */
  choiceText: string
  /** The specific word normalized/tokenized */
  word: string
  /** Sentence extracted from choice text by LookupText */
  requestSentence: string
  /** Passage text (either string or array of strings) */
  passage?: string | string[] | null
  /** Question prompt / stem */
  prompt?: string | null
}

const BLANK_REGEX = /_{2,}|\[blank\]|<u>_*<\/u>/i

function countWords(str: string): number {
  return str.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Resolves a context sentence for a word looked up in an answer choice.
 * If the choice text is already a full sentence, returns it.
 * If the passage contains a fill-in-the-blank marker, substitutes the choice into the passage sentence.
 * Otherwise, combines prompt/passage context with the choice text.
 */
export function resolveChoiceContext(params: ResolveChoiceContextParams): string {
  const { choiceText, word, requestSentence, passage, prompt } = params

  // 1. If requestSentence is already a full sentence (>= 5 words), return it directly.
  if (countWords(requestSentence) >= 5) {
    return requestSentence
  }

  // 2. Extract passage text if present.
  const passageText = Array.isArray(passage) ? passage.join('\n\n') : (passage ?? '')

  // 3. Search for a fill-in-the-blank marker in the passage.
  if (passageText) {
    const match = BLANK_REGEX.exec(passageText)
    if (match) {
      const blankIndex = match.index
      const rawSentence = sentenceAt(passageText, blankIndex)
      if (rawSentence) {
        const cleanChoice = choiceText.trim()
        const filledSentence = rawSentence.replace(BLANK_REGEX, cleanChoice)
        if (filledSentence && filledSentence !== rawSentence) {
          return filledSentence
        }
      }
    }
  }

  // 4. If passage text exists but has no blank marker
  if (passageText.trim()) {
    const firstSentence = sentenceAt(passageText.trim(), 0)
    if (firstSentence && countWords(firstSentence) >= 4) {
      return `${firstSentence} (Choice: ${choiceText.trim()})`
    }
  }

  // 5. If prompt exists, connect prompt with choice
  if (prompt?.trim()) {
    const cleanPrompt = prompt.trim().replace(/\?$/, '')
    return `${cleanPrompt}: ${choiceText.trim()}.`
  }

  return requestSentence || choiceText
}
