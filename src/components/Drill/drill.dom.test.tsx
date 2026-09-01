import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { JSDOM } from 'jsdom'

const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true },
)

const globals = globalThis as unknown as Record<string, unknown>
globals.window = dom.window
globals.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator,
})
globals.HTMLElement = dom.window.HTMLElement
globals.Element = dom.window.Element
globals.Node = dom.window.Node
globals.localStorage = dom.window.localStorage
globals.IS_REACT_ACT_ENVIRONMENT = true

const { createElement, useState } = await import('react')
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { DrillPanel } = await import('./DrillPanel.tsx')
const { ExamRunner } = await import('../Exam/ExamRunner.tsx')
const { drillToPracticeExam, toSourceLetter } = await import('../../drill/examAdapter.ts')
const { DEFAULT_DRILL_SETUP } = await import('../../drill/setup.ts')

type ExamResult = import('../Exam/ExamRunner.tsx').ExamResult

type Question = import('../../types.ts').Question
type DrillSetup = import('../../drill/setup.ts').DrillSetup

function question(
  id: string,
  domain: string,
  skill: string,
  difficulty: string,
): Question {
  return {
    id,
    assessment: 'SAT',
    test: 'Reading and Writing',
    domain,
    skill,
    difficulty,
    passage: 'Passage.',
    prompt: `Prompt ${id}?`,
    choices: { A: 'alpha', B: 'bravo', C: 'charlie', D: 'delta' },
    answer: 'B',
    rationale: 'Because.',
  }
}

const BANK: Question[] = [
  ...Array.from({ length: 6 }, (_, index) =>
    question(`i${index}`, 'Information and Ideas', 'Command of Evidence', 'Easy'),
  ),
  question('c0', 'Craft and Structure', 'Words in Context', 'Hard'),
  question('c1', 'Craft and Structure', 'Words in Context', 'Easy'),
  question('c2', 'Craft and Structure', 'Text Structure and Purpose', 'Hard'),
]

function buttonNamed(container: Element, text: string) {
  return [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim().startsWith(text),
  )
}

describe('the drill setup panel', () => {
  it('narrows the set as the target narrows, and starts what the readout promises', async () => {
    const container = dom.window.document.createElement('div')
    dom.window.document.body.append(container)
    const root = createRoot(container)
    const started: Array<{ setup: DrillSetup; questions: Question[] }> = []

    function Harness() {
      const [setup, setSetup] = useState<DrillSetup>({ ...DEFAULT_DRILL_SETUP, count: 5 })
      return createElement(DrillPanel, {
        questions: BANK,
        seen: {},
        setup,
        onChangeSetup: setSetup,
        onStart: (next: DrillSetup, questions: Question[]) =>
          started.push({ setup: next, questions }),
        onBack: () => {},
        onOpenVault: () => {},
        vaultOpenCount: 3,
      })
    }

    await act(async () => {
      root.render(createElement(Harness))
    })

    // Mixed and open: the readout offers the whole requested length.
    assert.equal(container.querySelector('.drill__readout-line strong')?.textContent, '5')
    // Skills belong to a domain, so the mixed target doesn't offer them.
    assert.equal(container.querySelector('[data-drill-group="Skill"]'), null)

    await act(async () => {
      buttonNamed(container, 'Craft')?.click()
    })

    const skillGroup = container.querySelector('[data-drill-group="Skill"]')!
    assert.ok(skillGroup, 'choosing a domain offers its skills')
    assert.deepEqual(
      [...skillGroup.querySelectorAll('button')].map((button) => button.textContent?.trim()),
      ['Every skill', 'Words in Context', 'Text Structure and Purpose'],
    )

    await act(async () => {
      buttonNamed(container, 'Words in Context')?.click()
    })
    await act(async () => {
      buttonNamed(skillGroup.ownerDocument.body, 'Hard')?.click()
    })

    // One question matches, so the panel says so rather than promising five.
    assert.equal(container.querySelector('.drill__readout-line strong')?.textContent, '1')
    assert.match(
      container.querySelector('.drill__warn')?.textContent ?? '',
      /That target is thin right now, so this drill runs short\./,
    )
    // The bank's size is never on screen - only the length you asked for.
    assert.doesNotMatch(container.textContent ?? '', /\b9 |\b3 questions match/)

    await act(async () => {
      buttonNamed(container, 'Start the drill')?.click()
    })

    assert.equal(started.length, 1)
    assert.deepEqual(started[0].questions.map((entry) => entry.id), ['c0'])
    assert.equal(started[0].setup.skill, 'Words in Context')
    assert.equal(started[0].setup.difficulty, 'Hard')

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('refuses to start when nothing in the bank matches', async () => {
    const container = dom.window.document.createElement('div')
    dom.window.document.body.append(container)
    const root = createRoot(container)
    let starts = 0

    await act(async () => {
      root.render(
        createElement(DrillPanel, {
          questions: BANK,
          seen: {},
          setup: {
            ...DEFAULT_DRILL_SETUP,
            domain: 'Craft and Structure',
            skill: 'Text Structure and Purpose',
            difficulty: 'Medium',
          },
          onChangeSetup: () => {},
          onStart: () => { starts += 1 },
          onBack: () => {},
          onOpenVault: () => {},
          vaultOpenCount: 0,
        }),
      )
    })

    const start = buttonNamed(container, 'Start the drill') as HTMLButtonElement
    assert.equal(start.disabled, true)
    await act(async () => {
      start.click()
    })
    assert.equal(starts, 0)
    assert.match(
      container.querySelector('.drill__warn')?.textContent ?? '',
      /Nothing in the bank matches that target yet/,
    )

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})

describe('a drill in the exam runner', () => {
  it('carries a bank question into the exam shape, and the answer back out', () => {
    const shuffled = drillToPracticeExam(
      [{ question: BANK[6], isReview: true }],
      DEFAULT_DRILL_SETUP,
    )
    const [module] = shuffled.exam.modules
    assert.equal(shuffled.exam.modules.length, 1, 'a drill is one module')
    assert.equal(module.questions.length, 1)

    const converted = module.questions[0]
    assert.equal(converted.id, BANK[6].id)
    assert.deepEqual(converted.passage, ['Passage.'])
    assert.equal(converted.stem, BANK[6].prompt)
    assert.equal(converted.topic, 'Craft and Structure')
    assert.equal(converted.subtopic, 'Words in Context')
    // The bank writes Hard; the exam renderer reads hard.
    assert.equal(converted.difficulty, 'hard')

    // A resurfaced question is shuffled, so the letter the student sees is not
    // the letter the bank stores - and the key follows the text, not the slot.
    assert.deepEqual(
      converted.choices.map((choice) => choice.letter),
      ['A', 'B', 'C', 'D'],
    )
    const keyed = converted.choices.find((choice) => choice.letter === converted.answer)
    assert.equal(keyed?.text, BANK[6].choices[BANK[6].answer])
    assert.equal(toSourceLetter(shuffled, BANK[6].id, converted.answer ?? ''), BANK[6].answer)
    // A blank stays blank rather than becoming a letter.
    assert.equal(toSourceLetter(shuffled, BANK[6].id, ''), '')
  })

  it('moves on when the question clock runs out, keeping the answer already picked', async () => {
    const container = dom.window.document.createElement('div')
    dom.window.document.body.append(container)
    const root = createRoot(container)
    const converted = drillToPracticeExam(
      [BANK[6], BANK[7]].map((question) => ({ question, isReview: false })),
      { ...DEFAULT_DRILL_SETUP, count: 2, secondsPerQuestion: 1 },
    )
    let finished: ExamResult | null = null

    function named(label: string) {
      return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        (entry) => entry.textContent?.trim() === label,
      )
    }
    async function tick(ms: number) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, ms))
      })
    }

    await act(async () => {
      root.render(
        createElement(ExamRunner, {
          exam: converted.exam,
          learnerName: 'Test Learner',
          theme: 'dark' as const,
          timing: { kind: 'fixed' as const, minutesPerModule: 1 / 60, label: 'One second' },
          perQuestionSeconds: 1,
          persistDraft: false,
          bannerLabel: 'THIS IS A DRILL',
          onToggleTheme: () => {},
          onExit: () => {},
          onFinish: (result: ExamResult) => { finished = result },
        }),
      )
    })

    const begin = named('Begin module')
    assert.ok(begin, 'the drill opens on its interstitial')
    await act(async () => begin.click())
    assert.match(container.textContent ?? '', /THIS IS A DRILL/)
    // Going back would hand out a second clock on a question already spent.
    assert.equal((named('Back') as HTMLButtonElement).disabled, true)

    // Pick an answer and let the clock beat the Next button.
    const choice = Array.from(container.querySelectorAll<HTMLButtonElement>('.exam-choice')).find(
      (entry) => entry.textContent?.includes('bravo'),
    )
    assert.ok(choice)
    await act(async () => choice.click())
    await tick(1400)

    // Question two, on a fresh clock - and nothing revealed on the way.
    assert.equal(container.querySelector('.exam-question-number')?.textContent, '2')
    assert.doesNotMatch(container.textContent ?? '', /Correct|Not this one|right so far/)
    assert.equal(finished, null)

    await tick(1400)

    assert.ok(finished, 'the last question closes the drill instead of a review page')
    const result = finished as unknown as ExamResult
    // The picked answer survived the clock; the untouched question is blank.
    assert.equal(toSourceLetter(converted, BANK[6].id, result.answers[BANK[6].id] ?? ''), 'B')
    assert.equal(result.answers[BANK[7].id], undefined)

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})
