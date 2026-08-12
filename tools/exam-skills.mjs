// One skill vocabulary for every exam in the practice programme.
//
// Each source labels its questions differently - Kaplan writes "Verb Tense",
// TestAdvantage writes "Domain 4 | Verb Forms", CookSAT writes nothing at all -
// but the report only means something if a student's Boundaries score on exam 1
// counts the same items as their Boundaries score on exam 4. Everything is
// folded into the ten College Board skills below.

export const CRAFT = 'Craft and Structure'
export const INFO = 'Information and Ideas'
export const CONVENTIONS = 'Standard English Conventions'
export const EXPRESSION = 'Expression of Ideas'

export const TOPIC_OF = {
  'Words in Context': CRAFT,
  'Text Structure and Purpose': CRAFT,
  'Cross-Text Connections': CRAFT,
  'Central Ideas and Details': INFO,
  'Command of Evidence': INFO,
  Inferences: INFO,
  Boundaries: CONVENTIONS,
  'Form, Structure, and Sense': CONVENTIONS,
  Transitions: EXPRESSION,
  'Rhetorical Synthesis': EXPRESSION,
}

const ALIASES = {
  // Craft and Structure
  'words in context': 'Words in Context',
  'logical completion': 'Words in Context',
  vocabulary: 'Words in Context',
  'text structure and purpose': 'Text Structure and Purpose',
  'structure and purpose': 'Text Structure and Purpose',
  structure: 'Text Structure and Purpose',
  purpose: 'Text Structure and Purpose',
  'function of underlined portion': 'Text Structure and Purpose',
  'cross-text connections': 'Cross-Text Connections',
  connections: 'Cross-Text Connections',
  'author response': 'Cross-Text Connections',

  // Information and Ideas
  'central ideas and details': 'Central Ideas and Details',
  'main idea': 'Central Ideas and Details',
  detail: 'Central Ideas and Details',
  details: 'Central Ideas and Details',
  'command of evidence': 'Command of Evidence',
  'command of evidence (textual)': 'Command of Evidence',
  'command of evidence (quantitative)': 'Command of Evidence',
  'command of evidence: textual': 'Command of Evidence',
  'command of evidence: quantitative': 'Command of Evidence',
  support: 'Command of Evidence',
  'illustrate the claim': 'Command of Evidence',
  'data completes a statement': 'Command of Evidence',
  graph: 'Command of Evidence',
  inferences: 'Inferences',
  inference: 'Inferences',
  'logical conclusion': 'Inferences',

  // Standard English Conventions
  boundaries: 'Boundaries',
  semicolons: 'Boundaries',
  'period or semicolon': 'Boundaries',
  'commas, dashes, and colons': 'Boundaries',
  'paired commas': 'Boundaries',
  'parenthetical elements': 'Boundaries',
  'restrictive vs nonrestrictive': 'Boundaries',
  'no punctuation needed': 'Boundaries',
  'dependent + independent clause': 'Boundaries',
  'form, structure, and sense': 'Form, Structure, and Sense',
  'sentence structure': 'Form, Structure, and Sense',
  'subject-verb agreement': 'Form, Structure, and Sense',
  'verb tense': 'Form, Structure, and Sense',
  'verb forms': 'Form, Structure, and Sense',
  modifiers: 'Form, Structure, and Sense',
  'plural vs possessive': 'Form, Structure, and Sense',
  pronouns: 'Form, Structure, and Sense',

  // Expression of Ideas
  transitions: 'Transitions',
  contrast: 'Transitions',
  concession: 'Transitions',
  continuous: 'Transitions',
  'cause and effect': 'Transitions',
  'example or illustration': 'Transitions',
  'rhetorical synthesis': 'Rhetorical Synthesis',
  'sequence/ specifity': 'Rhetorical Synthesis',
  'sequence/specificity': 'Rhetorical Synthesis',
  'generalization/ effect/ context': 'Rhetorical Synthesis',
  'differences/ similarities': 'Rhetorical Synthesis',
}

/** Canonical skill name for a source label, or null when nothing matches. */
export function canonicalSkill(label) {
  if (!label) return null
  const key = label.trim().toLowerCase().replace(/\s+/g, ' ')
  return ALIASES[key] ?? null
}

// CookSAT ships no skill labels at all, so the question stem is the only
// signal. Every Digital SAT stem is boilerplate, which makes this reliable in
// practice - the fallbacks below only fire on wording the bank has not used.
const STEM_RULES = [
  [/most logical and precise word or phrase/i, 'Words in Context'],
  [/most nearly mean|most likely mean when/i, 'Words in Context'],
  [/most logical transition/i, 'Transitions'],
  [/information from the notes/i, 'Rhetorical Synthesis'],
  [/data from the (graph|table|chart)/i, 'Command of Evidence'],
  [/(would|most directly|most effectively).{0,40}(support|weaken|illustrate|undermine)/i, 'Command of Evidence'],
  [/quotation from .* most effectively/i, 'Command of Evidence'],
  [/function of the (underlined|reference)/i, 'Text Structure and Purpose'],
  [/overall structure of the text/i, 'Text Structure and Purpose'],
  [/main purpose of the text/i, 'Text Structure and Purpose'],
  [/based on the texts/i, 'Cross-Text Connections'],
  [/author of text 1/i, 'Cross-Text Connections'],
  [/both texts/i, 'Cross-Text Connections'],
  [/main idea of the text/i, 'Central Ideas and Details'],
  [/according to the text/i, 'Central Ideas and Details'],
  [/based on the text.*describe/i, 'Central Ideas and Details'],
  [/most logically completes the text/i, 'Inferences'],
  [/can most reasonably be inferred/i, 'Inferences'],
  [/research suggest|findings suggest|most strongly suggests/i, 'Inferences'],
  [/conforms to the conventions of Standard English/i, null], // resolved below
]

// A punctuation-only question - the four choices are the same words with
// different marks between them - is Boundaries; anything else in the
// conventions block is Form, Structure, and Sense.
function conventionsSkill(choices) {
  const stripped = choices.map((choice) =>
    choice.text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(),
  )
  const allSame = stripped.every((text) => text === stripped[0])
  return allSame ? 'Boundaries' : 'Form, Structure, and Sense'
}

/** Best-guess skill from the question stem, for banks that ship untagged. */
export function skillFromStem(stem, choices) {
  for (const [pattern, skill] of STEM_RULES) {
    if (!pattern.test(stem)) continue
    if (skill) return skill
    return conventionsSkill(choices)
  }
  return null
}
