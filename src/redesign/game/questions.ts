// Questions for the redesign: the live bank at /data/questions.json, with a
// handful of real items bundled so the landing page plays even offline.

import type { Question } from '../../types.ts'
import { hash, seeded } from './engine.ts'
import type { Difficulty } from './content.ts'
import { examQuestionById } from './exams.ts'

type Letter = 'A' | 'B' | 'C' | 'D'
export const LETTERS: Letter[] = ['A', 'B', 'C', 'D']

const base = (fields: Pick<Question, 'id' | 'skill' | 'domain' | 'difficulty' | 'passage' | 'prompt' | 'choices' | 'answer' | 'rationale'>): Question => ({
  assessment: 'SAT',
  test: 'Reading and Writing',
  ...fields,
})

export const STARTER: Question[] = [
  base({
    id: 'e0bd4f8a',
    skill: 'Transitions',
    domain: 'Expression of Ideas',
    difficulty: 'Easy',
    passage:
      'In 1942, the 1,500-mile Alaska Highway was constructed in under nine months, largely due to the skilled work of nearly 4,000 African American soldiers from US Army engineering regiments. The soldiers’ contribution was overlooked for decades. ______ in 2017, lawmakers declared October 25 a day of recognition—“Alaska Highway Day”—for the troops who helped build this critical roadway.',
    prompt: 'Which choice completes the text with the most logical transition?',
    choices: { A: 'Lastly,', B: 'Then,', C: 'Similarly,', D: 'For example,' },
    answer: 'B',
    rationale:
      '“Then” signals that the 2017 declaration comes next in a chronological sequence, after the decades in which the soldiers’ contribution was overlooked. “Similarly” and “For example” would need the 2017 event to resemble or illustrate the overlooking; it does the opposite. “Lastly” marks the end of a list, and there is no list.',
  }),
  base({
    id: 'fa014d2d',
    skill: 'Words in Context',
    domain: 'Craft and Structure',
    difficulty: 'Easy',
    passage:
      'The invention in 1958 of the integrated circuit (or microchip) radically altered the semiconductor industry. In fact, some historians argue that it fundamentally ______ the industry by enabling it to take advantage of mass production methods for the first time.',
    prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
    choices: { A: 'overwhelmed', B: 'bypassed', C: 'obstructed', D: 'transformed' },
    answer: 'D',
    rationale:
      '“Transformed” means substantially changed, which matches “radically altered” and the new use of mass production. Nothing in the text says the industry was overwhelmed, bypassed, or obstructed — those words point in other directions.',
  }),
  base({
    id: 'de55ec71',
    skill: 'Boundaries',
    domain: 'Standard English Conventions',
    difficulty: 'Easy',
    passage:
      'Generations of mystery and horror ______ have been influenced by the dark, gothic stories of celebrated American author Edgar Allan Poe (1809–1849).',
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    choices: { A: 'writers', B: 'writers,', C: 'writers—', D: 'writers;' },
    answer: 'A',
    rationale:
      'The subject (“Generations of mystery and horror writers”) runs straight into its verb (“have been influenced”). No punctuation belongs between a subject and its verb, so the comma, dash, and semicolon all break the sentence.',
  }),
  base({
    id: '84b5125b',
    skill: 'Words in Context',
    domain: 'Craft and Structure',
    difficulty: 'Easy',
    passage:
      'Artist Marilyn Dingle’s intricate, coiled baskets are ______ sweetgrass and palmetto palm. Following a Gullah technique that originated in West Africa, Dingle skillfully winds a thin palm frond around a bunch of sweetgrass with the help of a “sewing bone” to create the basket’s signature look that no factory can reproduce.',
    prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
    choices: { A: 'indicated by', B: 'handmade from', C: 'represented by', D: 'collected with' },
    answer: 'B',
    rationale:
      'Dingle winds the frond around the sweetgrass by hand, in a look “no factory can reproduce” — so the baskets are handmade from those plants. The other choices describe signs, symbols, or gathering, not making.',
  }),
  base({
    id: '4b0c7b62',
    skill: 'Boundaries',
    domain: 'Standard English Conventions',
    difficulty: 'Easy',
    passage:
      'The algaita is a double reed wind instrument from West Africa. The reed of a wind instrument is the mouthpiece ______ A double reed contains two pieces of cane that vibrate and produce sound as air passes between them.',
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    choices: { A: 'where sound is made?', B: 'where is sound made.', C: 'where sound is made.', D: 'where is sound made?' },
    answer: 'C',
    rationale:
      'The sentence is a statement, not a question, so it ends with a period, and a statement keeps normal word order: “where sound is made.” Question marks and the inverted “where is sound made” belong to direct questions.',
  }),
  base({
    id: '660d50dc',
    skill: 'Transitions',
    domain: 'Expression of Ideas',
    difficulty: 'Easy',
    passage:
      'Samuel Coleridge-Taylor was a prominent classical music composer from England who toured the US three times in the early 1900s. The child of a West African father and an English mother, Coleridge-Taylor emphasized his mixed-race ancestry. For example, he referred to himself as Anglo-African. ______ he incorporated the sounds of traditional African music into his classical music compositions.',
    prompt: 'Which choice completes the text with the most logical transition?',
    choices: { A: 'In addition,', B: 'Actually,', C: 'However,', D: 'Regardless,' },
    answer: 'A',
    rationale:
      '“In addition” adds a second way he emphasized his ancestry to the first one (calling himself Anglo-African). “However” and “Regardless” signal contrast, and “Actually” signals a correction; nothing here is contrasted or corrected.',
  }),
]

let everything: Question[] = STARTER
let cache: Promise<Question[]> | null = null

export function loadBank(): Promise<Question[]> {
  cache ??= fetch('/data/questions.json')
    .then((response) => (response.ok ? (response.json() as Promise<Question[]>) : STARTER))
    .then((all) => {
      everything = all
      // figures and underlined portions don't survive into the plain-text bank, so
      // new pages leave those questions to the live app
      return all.filter((question) => !question.has_figure && !/underlined/i.test(question.prompt) && question.passage.length < 1100)
    })
    .catch(() => STARTER)
  return cache
}

/** Any question by id — including ones new pages skip, so a filed miss always comes back. */
export function byId(bank: Question[], id: string): Question | undefined {
  return (
    bank.find((question) => question.id === id) ??
    everything.find((question) => question.id === id) ??
    STARTER.find((question) => question.id === id) ??
    examQuestionById(id)
  )
}

/** A page of `count` questions from one skill at one difficulty, skipping ones already on file. */
export function pickPage(
  bank: Question[],
  skill: string | null,
  difficulty: Difficulty | null,
  count: number,
  seed: string,
  avoid: Set<string> = new Set(),
): Question[] {
  const rand = seeded(hash(seed))
  const fits = (question: Question) =>
    (!skill || question.skill === skill) && (!difficulty || question.difficulty === difficulty) && !avoid.has(question.id)
  let pool = bank.filter(fits)
  if (pool.length < count) pool = bank.filter((question) => !skill || question.skill === skill)
  const shuffled = [...pool].sort(() => rand() - 0.5)
  return shuffled.slice(0, count)
}

/**
 * A comeback wears a disguise: same question, choices in a new order, so the
 * student has to re-solve it rather than remember a letter.
 */
export function disguise(question: Question, seed: string): Question {
  const rand = seeded(hash(`${seed}:${question.id}`))
  const order = [...LETTERS].sort(() => rand() - 0.5)
  const choices = {} as Record<Letter, string>
  const moved = {} as Record<Letter, Letter>
  order.forEach((from, index) => {
    const to = LETTERS[index]
    choices[to] = question.choices[from]
    moved[from] = to
  })
  // the rationale names letters ("Choice B is the best answer"), so it moves too
  const rationale = question.rationale.replace(/\bChoice ([ABCD])\b/g, (_, letter: Letter) => `Choice ${moved[letter]}`)
  return { ...question, choices, answer: moved[question.answer], rationale }
}
