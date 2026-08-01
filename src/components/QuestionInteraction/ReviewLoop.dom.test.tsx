import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { JSDOM } from 'jsdom'

import type { Attempt, FirstPass, Question } from '../../types.ts'

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

const { createElement } = await import('react')
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { QuestionInteraction } = await import('./QuestionInteraction.tsx')

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)

const question: Question = {
  id: 'q1',
  assessment: 'SAT',
  test: 'Reading and Writing',
  domain: 'Information and Ideas',
  skill: 'Inferences',
  difficulty: 'Medium',
  passage: 'Beavers fell trees to build dams. The dams slow the current. Slower water spreads into new wetland.',
  prompt: 'Which choice best completes the text?',
  choices: {
    A: 'Beavers avoid moving water entirely.',
    B: 'Beaver dams create wetland by slowing the current.',
    C: 'Trees grow faster near beaver dams.',
    D: 'Wetlands form only where beavers are absent.',
  },
  answer: 'B',
  rationale: 'The text says the dams slow the current and the slower water spreads into new wetland.',
}

const missed: FirstPass = {
  chosen: 'A',
  confidence: 'sure',
  correct: false,
  timeMs: 40000,
  timedOut: false,
  struckChoices: [],
}

const completed: Attempt[] = []
let nextCalls = 0

function text() {
  return container.textContent ?? ''
}

function buttonByText(label: string) {
  return [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === label,
  ) ?? null
}

function choiceButton(needle: string) {
  return [...container.querySelectorAll('button.choice-select')].find(
    (button) => button.textContent?.includes(needle),
  ) ?? null
}

async function click(element: Element | null) {
  assert.ok(element)
  await act(async () => {
    element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
}

async function selectReason(value: string) {
  const select = container.querySelector('select.reason-select') as HTMLSelectElement | null
  assert.ok(select)
  await act(async () => {
    select.value = value
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  })
}

before(async () => {
  await act(async () => {
    root.render(
      createElement(QuestionInteraction, {
        question,
        isReview: true,
        firstPass: missed,
        reviewStage: 0,
        onComplete: (attempt: Attempt) => completed.push(attempt),
        onNext: () => { nextCalls += 1 },
      }),
    )
  })
})

describe('review loop', () => {
  it('opens on the redo with the first pick marked and the answer hidden', () => {
    assert.ok(text().includes('You missed this in the set'))
    assert.ok(!text().includes(question.rationale))
    assert.equal(choiceButton('Beavers avoid moving water entirely')?.getAttribute('aria-disabled'), 'true')
  })

  it('keeps the redo open on another wrong choice', async () => {
    await click(choiceButton('Trees grow faster near beaver dams'))
    assert.ok(text().includes('Not this one - try again'))
    assert.ok(!text().includes('Why was your answer wrong?'))
  })

  it('reaches the contrast once the right answer is found', async () => {
    await click(choiceButton('Beaver dams create wetland'))
    assert.ok(text().includes('put the two side by side'))
    assert.ok(text().includes('Correct answer'))
    assert.ok(text().includes('Your answer'))
    assert.ok(text().includes('Why was your answer wrong?'))
  })

  it('keeps the reasoning behind a toggle so the student generates first', async () => {
    assert.ok(!text().includes(question.rationale))
    await click(buttonByText('Show'))
    assert.ok(text().includes(question.rationale))
  })

  it('holds Continue until a reason is picked', async () => {
    assert.equal(buttonByText('Continue')?.hasAttribute('disabled'), true)
    await selectReason('It was too extreme or absolute')
    assert.equal(buttonByText('Continue')?.hasAttribute('disabled'), false)
  })

  it('asks why it was missed only after the breakdown', async () => {
    await click(buttonByText('Continue'))
    assert.ok(text().includes('why did you miss it the first time?'))
    assert.ok(buttonByText('Fell for a trap answer'))
  })

  it('finishes in three screens and logs the diagnosis', async () => {
    await click(buttonByText('Fell for a trap answer'))
    assert.ok(text().includes('Error diagnosed.'))
    assert.ok(text().includes('You were sure - and missed it'))

    assert.equal(completed.length, 1)
    const attempt = completed[0]
    assert.equal(attempt.chosen, 'A')
    assert.equal(attempt.correct, false)
    assert.equal(attempt.errorCause, 'trap')
    assert.equal(attempt.selfExplanations?.whyWrong, 'It was too extreme or absolute')

    await click(buttonByText('Next'))
    assert.equal(nextCalls, 1)
  })

  it('never shows the removed evidence, chain, or trap steps', () => {
    assert.ok(!text().includes('underline'))
    assert.ok(!text().includes('What was actually being asked'))
    assert.ok(!text().includes('Name the trap'))
    assert.ok(!text().includes('Specimen found'))
  })
})
