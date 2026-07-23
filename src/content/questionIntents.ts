// The middle link of the logic chain (Step 3.5b) asks the student to identify
// what the question is actually testing. We don't have authored paraphrases per
// question, but the SAT skill a question belongs to determines its intent
// exactly — so the correct option is the question's own skill intent, and the
// foils are other skills' intents. This teaches "read what's actually asked"
// without fabricating per-question data.

export const QUESTION_INTENTS: Record<string, string> = {
  'Central Ideas and Details': 'Find the main idea the whole text establishes.',
  'Command of Evidence': 'Find the choice best supported by the text or data.',
  Inferences: 'Find the conclusion the text most logically leads to.',
  'Cross-Text Connections': 'Find how the two texts relate to each other.',
  'Text Structure and Purpose': 'Identify why the text is built the way it is.',
  'Words in Context': 'Find the word that fits the sentence’s meaning and tone.',
  'Rhetorical Synthesis': 'Find the choice that best meets the writer’s stated goal.',
  Transitions: 'Find the transition that fits the logic between the ideas.',
  Boundaries: 'Find the punctuation that joins the sentence correctly.',
  'Form, Structure, and Sense': 'Find the grammatically correct form of the word.',
}

const FALLBACK_INTENT = 'Find the choice the text best supports.'

// Deterministic small hash so the same question always builds the same options
// (order included) — important because a resurfaced question must look stable.
function seededOrder<T>(items: T[], seed: string): T[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return items
    .map((item, i) => ({ item, key: (h ^ Math.imul(i + 1, 2654435761)) >>> 0 }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item)
}

export type IntentChoices = {
  options: string[]
  correctIndex: number
}

// Build a 3-option intent picker for a question: its true skill intent plus two
// distinct foils drawn from other skills, in a stable seeded order.
export function buildIntentChoices(skill: string, questionId: string): IntentChoices {
  const correct = QUESTION_INTENTS[skill] ?? FALLBACK_INTENT
  const foilPool = Object.entries(QUESTION_INTENTS)
    .filter(([foilSkill, intent]) => foilSkill !== skill && intent !== correct)
    .map(([, intent]) => intent)
  const foils = seededOrder(foilPool, questionId).slice(0, 2)
  const options = seededOrder([correct, ...foils], `opts-${questionId}`)
  return { options, correctIndex: options.indexOf(correct) }
}
