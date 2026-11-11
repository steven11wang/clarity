// Static content for the Mistake Notebook redesign: the four domains and their highlighter
// inks, the ten skills, the five traps, the path, the reward catalogues and the
// Speed Round ranks. Pure data — no React, no storage.

import type { TrapType } from '../../types.ts'

export type Ink = 'yellow' | 'pink' | 'green' | 'blue' | 'orange' | 'violet' | 'red'

export type Domain = {
  id: string
  name: string
  short: string
  ink: Ink
  skills: string[]
}

// Digital SAT module order: Craft and Structure, Information and Ideas,
// Standard English Conventions, Expression of Ideas.
export const DOMAINS: Domain[] = [
  {
    id: 'craft',
    name: 'Craft and Structure',
    short: 'Craft',
    ink: 'pink',
    skills: ['Words in Context', 'Text Structure and Purpose', 'Cross-Text Connections'],
  },
  {
    id: 'info',
    name: 'Information and Ideas',
    short: 'Info',
    ink: 'green',
    skills: ['Central Ideas and Details', 'Command of Evidence', 'Inferences'],
  },
  {
    id: 'conventions',
    name: 'Standard English Conventions',
    short: 'Conventions',
    ink: 'orange',
    skills: ['Boundaries', 'Form, Structure, and Sense'],
  },
  {
    id: 'expression',
    name: 'Expression of Ideas',
    short: 'Expression',
    ink: 'blue',
    skills: ['Transitions', 'Rhetorical Synthesis'],
  },
]

export const ALL_SKILLS = DOMAINS.flatMap((domain) => domain.skills)

export const SKILL_SHORT: Record<string, string> = {
  'Words in Context': 'Words',
  'Text Structure and Purpose': 'Structure',
  'Cross-Text Connections': 'Cross-Text',
  'Central Ideas and Details': 'Central Idea',
  'Command of Evidence': 'Evidence',
  Inferences: 'Inferences',
  Boundaries: 'Boundaries',
  'Form, Structure, and Sense': 'Form & Sense',
  Transitions: 'Transitions',
  'Rhetorical Synthesis': 'Synthesis',
}

export function domainOf(skill: string): Domain {
  return DOMAINS.find((domain) => domain.skills.includes(skill)) ?? DOMAINS[0]
}

export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * A trap is the way a wrong answer got picked. The five reading traps are the
 * originals (and the ones printed on stickers); grammar, vocabulary and
 * transition questions go wrong in their own ways, so they have their own.
 */
export type TrapId =
  | TrapType
  | 'near-synonym'
  | 'wrong-tone'
  | 'run-on'
  | 'fragment'
  | 'extra-comma'
  | 'unpaired'
  | 'agreement'
  | 'tense'
  | 'modifier'
  | 'possessive'
  | 'wrong-link'
  | 'half-read'
  | 'wrong-goal'

/** `tell` is how to spot it; `fix` is the one move that beats it next time. */
export type Trap = { id: TrapId; name: string; tell: string; fix: string }

export const TRAPS: Trap[] = [
  { id: 'too-extreme', name: 'Too extreme', tell: 'Always, never, proves — stronger than the text allows.', fix: 'Circle the strongest word in the choice and find the line that backs it. No line, no pick.' },
  { id: 'half-right', name: 'Half right', tell: 'Starts true, then slips one wrong word in.', fix: 'Read the choice to its last word. One wrong word sinks the whole thing.' },
  { id: 'true-but-irrelevant', name: 'True but irrelevant', tell: 'Accurate, but answers a different question.', fix: 'Say the question back in your own words before you look at the choices.' },
  { id: 'out-of-scope', name: 'Out of scope', tell: 'Brings in something the text never says.', fix: 'Point to the words in the text that say it. If you can’t, it isn’t there.' },
  { id: 'opposite', name: 'Opposite', tell: 'Flips the direction of the claim.', fix: 'Mark each sentence as for or against before you choose.' },
]

const OTHER_TRAPS: Trap[] = [
  { id: 'near-synonym', name: 'Close, wrong fit', tell: 'Means nearly the same, but not the way this sentence uses it.', fix: 'Put your own word in the blank first, then find the choice that matches it.' },
  { id: 'wrong-tone', name: 'Wrong tone', tell: 'Right idea, wrong strength or feeling.', fix: 'Decide whether the sentence is positive, negative or neutral before you read the choices.' },
  { id: 'run-on', name: 'Run-on', tell: 'Two full sentences joined by a comma, or by nothing.', fix: 'Check both sides of the mark. Two full sentences need a period, a semicolon, or a comma with and/but/so.' },
  { id: 'fragment', name: 'Fragment', tell: 'A period or semicolon cuts off a piece that can’t stand alone.', fix: 'Read each side alone. If one side isn’t a sentence, a period or semicolon can’t go there.' },
  { id: 'extra-comma', name: 'Extra comma', tell: 'A comma splits things that belong together, like a subject and its verb.', fix: 'Lift out what sits between the commas. If the sentence breaks, the commas are wrong.' },
  { id: 'unpaired', name: 'Unpaired marks', tell: 'An aside opens with one mark and closes with another, or never closes.', fix: 'An aside needs a matching pair: two commas, two dashes or two parentheses.' },
  { id: 'agreement', name: 'Agreement', tell: 'The verb or pronoun doesn’t match its subject in number.', fix: 'Find the true subject, cross out everything between it and the verb, then match them.' },
  { id: 'tense', name: 'Wrong tense', tell: 'The verb’s tense or form doesn’t fit the timeline.', fix: 'Look at the other verbs nearby and stay in their time unless the text signals a shift.' },
  { id: 'modifier', name: 'Misplaced modifier', tell: 'The describing phrase is attached to the wrong thing.', fix: 'Whatever comes right after the opening phrase must be the thing it describes.' },
  { id: 'possessive', name: 'Plural or possessive', tell: 'Plural and possessive mixed up: its and it’s, writers and writer’s.', fix: 'Ask who owns what. No ownership, no apostrophe.' },
  { id: 'wrong-link', name: 'Wrong relationship', tell: 'Right direction, wrong link: adds where it should conclude, gives an example where it should give a cause.', fix: 'Cover the choices and name the link yourself: continue, contrast, cause or example.' },
  { id: 'half-read', name: 'Skipped the sentence before', tell: 'Fits the sentence with the blank, but not the one before it.', fix: 'A transition joins two sentences. Always read the one before the blank.' },
  { id: 'wrong-goal', name: 'Wrong goal', tell: 'True to the notes, but it does a different job than the question asks for.', fix: 'Underline the goal in the question, then check every part of the choice against it.' },
]

export const ALL_TRAPS: Trap[] = [...TRAPS, ...OTHER_TRAPS]

const pick = (...ids: TrapId[]): Trap[] => ids.map((id) => ALL_TRAPS.find((trap) => trap.id === id) as Trap)

const SKILL_TRAPS: Record<string, Trap[]> = {
  'Words in Context': pick('near-synonym', 'wrong-tone', 'opposite', 'out-of-scope'),
  Boundaries: pick('run-on', 'fragment', 'extra-comma', 'unpaired'),
  'Form, Structure, and Sense': pick('agreement', 'tense', 'modifier', 'possessive'),
  Transitions: pick('opposite', 'wrong-link', 'half-read'),
  'Rhetorical Synthesis': pick('wrong-goal', 'half-right', 'out-of-scope'),
}

/** The traps a question in this skill can spring. Reading skills share the original five. */
export function trapsFor(skill: string): Trap[] {
  return SKILL_TRAPS[skill] ?? TRAPS
}

export const trapById = (id: TrapId | null | undefined): Trap | undefined => ALL_TRAPS.find((trap) => trap.id === id)

export const trapName = (id: TrapId | null | undefined) => trapById(id)?.name ?? 'Unnamed'

// ---------------------------------------------------------------------------
// The path. Each skill is a short run of nodes; each domain closes with a
// chapter test and a sticker chest.

export type Difficulty = 'Easy' | 'Medium' | 'Hard'
export type NodeKind = 'lesson' | 'page' | 'boss' | 'chest'

export type PathNode = {
  id: string
  kind: NodeKind
  domainId: string
  skill: string | null
  difficulty: Difficulty | null
  title: string
}

export const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard']

export const PATH: PathNode[] = DOMAINS.flatMap((domain) => [
  ...domain.skills.flatMap((skill): PathNode[] => [
    {
      id: `${slug(skill)}-lesson`,
      kind: 'lesson',
      domainId: domain.id,
      skill,
      difficulty: null,
      title: `${SKILL_SHORT[skill]} in 2 minutes`,
    },
    ...DIFFICULTIES.map(
      (difficulty): PathNode => ({
        id: `${slug(skill)}-${difficulty.toLowerCase()}`,
        kind: 'page',
        domainId: domain.id,
        skill,
        difficulty,
        title: `${SKILL_SHORT[skill]} · ${difficulty}`,
      }),
    ),
  ]),
  {
    id: `${domain.id}-boss`,
    kind: 'boss',
    domainId: domain.id,
    skill: null,
    difficulty: 'Hard',
    title: `${domain.short} chapter test`,
  },
  {
    id: `${domain.id}-chest`,
    kind: 'chest',
    domainId: domain.id,
    skill: null,
    difficulty: null,
    title: 'Sticker chest',
  },
])

// ---------------------------------------------------------------------------
// Rewards. Stickers come in three finishes; holo foil is the only gradient in
// the whole system and it only ever appears on a reward.

export type Rarity = 'plain' | 'gloss' | 'holo'

export type Sticker = {
  id: string
  name: string
  rarity: Rarity
  ink: Ink
  // which drawn glyph sits on the sticker
  glyph: 'trap' | 'skill' | 'mascot' | 'stamp'
  outfit?: OutfitId
}

export const STICKERS: Sticker[] = [
  ...TRAPS.map((trap, index): Sticker => ({
    id: `trap-${trap.id}`,
    name: trap.name,
    rarity: 'plain',
    ink: (['red', 'orange', 'blue', 'violet', 'pink'] as Ink[])[index],
    glyph: 'trap',
  })),
  ...DOMAINS.flatMap((domain) =>
    domain.skills.map(
      (skill): Sticker => ({
        id: `skill-${slug(skill)}`,
        name: SKILL_SHORT[skill],
        rarity: 'gloss',
        ink: domain.ink,
        glyph: 'skill',
      }),
    ),
  ),
  { id: 'stamp-perfect', name: 'Perfect page', rarity: 'gloss', ink: 'red', glyph: 'stamp' },
  { id: 'mascot-scholar', name: 'Scholar 汤圆', rarity: 'holo', ink: 'yellow', glyph: 'mascot', outfit: 'scholar' },
  { id: 'mascot-specs', name: 'Specs 汤圆', rarity: 'holo', ink: 'blue', glyph: 'mascot', outfit: 'specs' },
  { id: 'mascot-beats', name: 'Beats 汤圆', rarity: 'holo', ink: 'pink', glyph: 'mascot', outfit: 'beats' },
  { id: 'mascot-nap', name: 'Nap 汤圆', rarity: 'holo', ink: 'violet', glyph: 'mascot', outfit: 'nap' },
]

export const RARITY_LABEL: Record<Rarity, string> = { plain: 'Plain', gloss: 'Gloss', holo: 'Holo foil' }

export type OutfitId = 'none' | 'scholar' | 'specs' | 'beats' | 'nap' | 'spark' | 'headband' | 'jade' | 'moonlit' | 'obsidian' | 'summer'

/**
 * `art` outfits are painted portraits (src/redesign/assets/avatars) rather than
 * drawn accessories. A `codeOnly` one can't be bought: it comes with a code.
 */
export type Outfit = { id: OutfitId; name: string; price: number; blurb: string; art?: true; codeOnly?: true }

export const OUTFITS: Outfit[] = [
  { id: 'none', name: 'Plain 汤圆', price: 0, blurb: 'Fresh from the bowl.' },
  { id: 'specs', name: 'Reading specs', price: 15, blurb: 'For close reading.' },
  { id: 'headband', name: 'Streak headband', price: 20, blurb: 'Seven days and counting.' },
  { id: 'spark', name: 'Gold hair clip', price: 25, blurb: 'Clips back a bad answer.' },
  { id: 'beats', name: 'Study headphones', price: 35, blurb: 'Lo-fi and focused.' },
  { id: 'nap', name: 'Night cap', price: 45, blurb: 'Rest is part of the plan.' },
  { id: 'scholar', name: 'Mortarboard', price: 60, blurb: 'Dressed for the 1550.' },
  { id: 'jade', name: 'Jade Atelier', price: 70, blurb: 'Green jade, edged in gold.', art: true },
  { id: 'moonlit', name: 'Moonlit Scholar', price: 90, blurb: 'Opal moon, midnight silk.', art: true },
  { id: 'obsidian', name: 'Obsidian Regent', price: 120, blurb: 'Black stone, gold laurel.', art: true },
  { id: 'summer', name: 'Summer Scholar', price: 0, blurb: 'From the Governor’s School summer where Clarity began.', art: true, codeOnly: true },
]

/**
 * The founding-member code, for the Governor's School where Clarity was born.
 * $10 of drops in all, split so the bigger half rewards the habit, not the
 * sign-up: some on the code, the rest after ten study days.
 */
export const FOUNDER = {
  title: 'Founding member',
  outfit: 'summer' as OutfitId,
  welcomeDrops: 30,
  goalDays: 10,
  goalDrops: 70,
}

// Prices are in water drops, and drops can be bought at 10 to the dollar, so
// every price here is also a real-money price: 15 drops is $1.50.
export const CORRECTION_TAPE_PRICE = 10

// ---------------------------------------------------------------------------
// Speed Round ranks: the writing kit, from pencil to the 800 Club.

export type Rank = { id: string; name: string; min: number; ink: Ink }

export const RANKS: Rank[] = [
  { id: 'pencil', name: 'Pencil', min: 0, ink: 'orange' },
  { id: 'ballpoint', name: 'Ballpoint', min: 100, ink: 'blue' },
  { id: 'gel', name: 'Gel Pen', min: 250, ink: 'pink' },
  { id: 'fountain', name: 'Fountain Pen', min: 450, ink: 'violet' },
  { id: 'club', name: '800 Club', min: 700, ink: 'yellow' },
]

// ---------------------------------------------------------------------------
// Study-group league tiers (weekly).

export const LEAGUES = ['Sticky Note', 'Index Card', 'Notebook', 'Journal', 'Library'] as const

// Sample rivals. Every place they appear is labelled as sample data.
export const SAMPLE_RIVALS = [
  { name: 'Mina K.', pet: 'specs', pace: 1.18 },
  { name: 'Leo W.', pet: 'beats', pace: 1.05 },
  { name: 'Ava R.', pet: 'scholar', pace: 0.97 },
  { name: 'Jun H.', pet: 'nap', pace: 0.9 },
  { name: 'Priya S.', pet: 'spark', pace: 0.86 },
  { name: 'Diego M.', pet: 'headband', pace: 0.8 },
  { name: 'Hana T.', pet: 'none', pace: 0.74 },
  { name: 'Omar F.', pet: 'specs', pace: 0.66 },
  { name: 'Yuki N.', pet: 'beats', pace: 0.6 },
  { name: 'Sam P.', pet: 'none', pace: 0.52 },
  { name: 'Chloe L.', pet: 'nap', pace: 0.45 },
  { name: 'Ben A.', pet: 'scholar', pace: 0.38 },
  { name: 'Iris Z.', pet: 'none', pace: 0.3 },
  { name: 'Tom G.', pet: 'spark', pace: 0.22 },
] as const satisfies ReadonlyArray<{ name: string; pet: OutfitId; pace: number }>

// ---------------------------------------------------------------------------
// Daily quests. Three a day, picked by the day; rewards are drops.

export type QuestKind =
  | 'turn-in-page'
  | 'beat-comebacks'
  | 'sure-and-right'
  | 'name-traps'
  | 'win-speed'
  | 'finish-lesson'
  | 'earn-xp'

export type QuestTemplate = { kind: QuestKind; label: (n: number) => string; target: number; ink: number }

export const QUEST_TEMPLATES: QuestTemplate[] = [
  { kind: 'turn-in-page', label: () => 'Turn in a page', target: 1, ink: 3 },
  { kind: 'beat-comebacks', label: (n) => `Beat ${n} comebacks`, target: 2, ink: 4 },
  { kind: 'sure-and-right', label: (n) => `Answer “Sure” and be right ${n} times`, target: 4, ink: 3 },
  { kind: 'name-traps', label: (n) => `Name ${n} traps`, target: 2, ink: 3 },
  { kind: 'win-speed', label: () => 'Win a Speed Round', target: 1, ink: 4 },
  { kind: 'finish-lesson', label: () => 'Finish a 2-minute lesson', target: 1, ink: 2 },
  { kind: 'earn-xp', label: (n) => `Earn ${n} XP`, target: 80, ink: 3 },
]

// Comebacks: a miss returns after these many days. Beat it at the last stage
// and it is cleared from the Mistake Notebook.
export const COMEBACK_DAYS = [1, 3, 7, 21]

// A right answer marked “Guessing” is clipped in as well, one rung up the
// ladder: it was right once, so it skips the next-day check and owes three
// spaced ones (3, 7 and 21 days) rather than four.
export const LUCKY_START_STAGE = 1

// From this stage on, a comeback brings a twin: a new question in the same
// skill, so beating it shows the skill moved and not just the memory of one answer.
export const TWIN_FROM_STAGE = 2

export const REWARDS = {
  firstTryXp: 10,
  firstTryInk: 1,
  comebackXp: 20,
  comebackInk: 2,
  trapXp: 3,
  pageXp: 15,
  perfectInk: 5,
  lessonXp: 25,
  speedWinXp: 30,
  speedWinInk: 3,
  speedWinRp: 28,
  speedLossRp: -14,
}
