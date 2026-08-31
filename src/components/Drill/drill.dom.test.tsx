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
const { DrillVerdict } = await import('./DrillVerdict.tsx')
const { DEFAULT_DRILL_SETUP } = await import('../../drill/setup.ts')

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

describe('the verdict between drill questions', () => {
  it('names the miss, the answer, and where the question goes next', async () => {
    const container = dom.window.document.createElement('div')
    dom.window.document.body.append(container)
    const root = createRoot(container)
    let advanced = 0

    await act(async () => {
      root.render(
        createElement(DrillVerdict, {
          question: BANK[6],
          isReview: false,
          firstPass: {
            chosen: 'D',
            confidence: null,
            correct: false,
            timeMs: 12_000,
            timedOut: false,
            struckChoices: [],
          },
          position: 3,
          total: 10,
          correctSoFar: 2,
          onContinue: () => { advanced += 1 },
        }),
      )
    })

    const text = container.textContent ?? ''
    assert.match(text, /Question 3 of 10 · 2 right so far/)
    assert.match(text, /Not this one\./)
    assert.match(text, /You picked/)
    assert.match(text, /delta/)
    assert.match(text, /bravo/)
    assert.match(text, /lands in your mistake vault/)

    // The control is already focused, so a keyboard run keeps its rhythm.
    const next = buttonNamed(container, 'Next question') as HTMLButtonElement
    assert.equal(dom.window.document.activeElement, next)

    await act(async () => {
      next.click()
    })
    assert.equal(advanced, 1)

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('closes a clean answer without offering a return', async () => {
    const container = dom.window.document.createElement('div')
    dom.window.document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        createElement(DrillVerdict, {
          question: BANK[6],
          isReview: false,
          firstPass: {
            chosen: 'B',
            confidence: null,
            correct: true,
            timeMs: 9_000,
            timedOut: false,
            struckChoices: [],
          },
          position: 10,
          total: 10,
          correctSoFar: 7,
          onContinue: () => {},
        }),
      )
    })

    const text = container.textContent ?? ''
    assert.match(text, /Correct\./)
    assert.match(text, /Nothing comes back from this one/)
    assert.doesNotMatch(text, /You picked/)
    // The last question closes the run rather than promising another.
    assert.ok(buttonNamed(container, 'Finish the drill'))

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})
