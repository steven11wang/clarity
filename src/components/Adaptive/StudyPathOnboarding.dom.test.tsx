import assert from 'node:assert/strict'
import { after, afterEach, beforeEach, describe, it } from 'node:test'

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

const { createElement } = await import('react')
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { AdaptiveExperience } = await import('./AdaptiveExperience.tsx')

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)

const baseProps = {
  primaryView: 'practice' as const,
  examPanel: null,
  reviewsPanel: null,
  wordsPanel: null,
  libraryPanel: null,
  reflectPanel: null,
  dueCount: 0,
  questions: [],
  progression: null,
  onProgressionChange: () => {},
  onOpenPractice: () => {},
  onOpenExam: () => {},
  onOpenLessons: () => {},
  onOpenReviews: () => {},
  onOpenWords: () => {},
  onOpenLibrary: () => {},
  onOpenReflect: () => {},
  onRecordAnswers: () => ({}),
  onRecordReview: () => {},
}

function buttonNamed(name: string) {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.textContent?.includes(name))
  assert.ok(button, `Expected a button containing “${name}”`)
  return button
}

async function renderFlow() {
  await act(async () => {
    root.render(createElement(AdaptiveExperience, baseProps))
  })
}

beforeEach(async () => {
  dom.window.localStorage.clear()
  await renderFlow()
})

afterEach(async () => {
  await act(async () => {
    root.render(createElement('div'))
  })
})

after(() => {
  act(() => root.unmount())
})

describe('first-entry study path onboarding', () => {
  it('starts by asking whether the learner has taken a full practice test', () => {
    assert.match(container.textContent ?? '', /How should you start SAT Reading\?/)
    assert.match(container.textContent ?? '', /I haven\u2019t taken a full practice test/)
    assert.match(container.textContent ?? '', /I\u2019ve taken at least one/)
  })

  it('sends a first-time test taker to the Bluebook recommendation', async () => {
    await act(async () => buttonNamed('I haven\u2019t taken').click())

    assert.match(container.textContent ?? '', /Take one practice test in Bluebook/)
    const bluebookLink = container.querySelector<HTMLAnchorElement>(
      'a[href="https://bluebook.collegeboard.org/"]',
    )
    assert.ok(bluebookLink)
    assert.equal(bluebookLink.target, '_blank')
  })

  it('builds the complete six-step plan from the selected entry point', async () => {
    await act(async () => buttonNamed('I\u2019ve taken at least one').click())
    assert.match(container.textContent ?? '', /Which one sounds like you\?/)

    await act(async () => buttonNamed('I studied, but never really practiced').click())

    assert.match(container.textContent ?? '', /Six steps\. You start at step 2\./)
    assert.match(container.textContent ?? '', /Find your untimed score/)
    assert.match(container.textContent ?? '', /Four untimed practice tests/)
    assert.match(container.textContent ?? '', /That is usually accuracy, not pace/)
    assert.match(container.textContent ?? '', /Drill the mistake\. Redo it\. Reflect on why\./)

    const steps = container.querySelectorAll('[data-study-path-step]')
    assert.equal(steps.length, 6)
    assert.equal(
      container.querySelector('[data-study-path-step="2"]')?.getAttribute('data-active'),
      'true',
    )
    assert.equal(
      container.querySelector('[data-study-path-step="1"]')?.getAttribute('data-earlier'),
      'true',
    )

    await act(async () => buttonNamed('Start at step 2').click())
    assert.match(container.textContent ?? '', /Turn your score report into your next adventure/)

    const saved = JSON.parse(
      dom.window.localStorage.getItem('clarity:v1:study-path-onboarding:anonymous') ?? 'null',
    )
    assert.equal(saved.startingStep, 2)
    assert.equal(saved.hasTakenPracticeTest, true)
  })

  it('saves the stuck-score learner at step 5', async () => {
    await act(async () => buttonNamed('I\u2019ve taken at least one').click())
    await act(async () => buttonNamed('I\u2019ve practiced, but my score won\u2019t move').click())
    await act(async () => buttonNamed('Start at step 5').click())

    assert.match(container.textContent ?? '', /Turn your score report into your next adventure/)
    const saved = JSON.parse(
      dom.window.localStorage.getItem('clarity:v1:study-path-onboarding:anonymous') ?? 'null',
    )
    assert.equal(saved.startingStep, 5)
  })
})
