// Mounts the real lesson into a DOM and drives it the way a student would.
// The condenser has its own unit tests; this is about the shell — that each tab
// renders the right thing, that the choices stay hidden until the student
// commits to a test phrase, and that striking a choice actually strikes it.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'

import { JSDOM } from 'jsdom'

// Resolved from the repo root: this file is bundled before it runs (node's
// test runner strips types but does not compile JSX), so import.meta.url points
// at the bundle rather than at this source file.
const pagesBody = readFileSync(
  new URL('public/lessons/skill-lessons.json', `file://${process.cwd()}/`),
  'utf8',
)

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})

const globals = globalThis as unknown as Record<string, unknown>
globals.window = dom.window
globals.document = dom.window.document
// node 22 exposes `navigator` as a getter-only global.
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator,
})
globals.HTMLElement = dom.window.HTMLElement
globals.Element = dom.window.Element
globals.Node = dom.window.Node
globals.getComputedStyle = dom.window.getComputedStyle
globals.requestAnimationFrame = (callback: FrameRequestCallback) =>
  dom.window.setTimeout(() => callback(Date.now()), 0) as unknown as number
globals.cancelAnimationFrame = (handle: number) => dom.window.clearTimeout(handle)
globals.IS_REACT_ACT_ENVIRONMENT = true
// jsdom implements neither scroll API; the lesson scrolls to top on tab change.
dom.window.Element.prototype.scrollIntoView = () => {}
dom.window.scrollTo = () => {}
globals.fetch = (async () => ({
  ok: true,
  json: async () => JSON.parse(pagesBody) as unknown,
})) as unknown as typeof fetch

// Imported after the DOM globals exist — React reads them at module scope.
const { createElement } = await import('react')
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { SkillLesson } = await import('./SkillLesson.tsx')
const { getSkillLessonSummary } = await import('../../content/skillLessons.ts')

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)
let finished = 0

function text(): string {
  return container.textContent ?? ''
}

function all(selector: string): HTMLElement[] {
  return [...container.querySelectorAll(selector)] as unknown as HTMLElement[]
}

function byText(selector: string, needle: string): HTMLElement {
  const found = all(selector).find((node) => (node.textContent ?? '').includes(needle))
  assert.ok(found, `no ${selector} containing "${needle}"`)
  return found
}

async function click(node: HTMLElement) {
  await act(async () => {
    node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
}

async function openTab(label: string) {
  await click(byText('.lesson-tab', label))
}

async function renderLesson(skill: string) {
  const summary = getSkillLessonSummary(skill)
  assert.ok(summary)
  await act(async () => {
    root.render(
      createElement(SkillLesson, {
        embedded: true,
        summary,
        finishLabel: 'Start the mini quiz',
        onFinish: () => {
          finished += 1
        },
        onExit: () => {},
      }),
    )
  })
  // Let the lesson fetch settle.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function fillInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype,
      'value',
    )?.set
    setValue?.call(input, value)
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
}

before(async () => {
  await renderLesson('Command of Evidence')
})

after(() => {
  act(() => root.unmount())
})

describe('skill lesson shell', () => {
  it('renders inside the persistent console without a second header', () => {
    assert.equal(container.querySelectorAll('.adaptive-header').length, 0)
    assert.ok(container.querySelector('.lesson-reader'))
    assert.match(
      container.querySelector('.lesson-reader__back')?.textContent ?? '',
      /All lessons/,
    )
  })

  it('offers four tabs, ending at Practice', () => {
    const labels = all('.lesson-tab__label').map((node) => node.textContent)
    assert.deepEqual(labels, ['Lesson', 'Worked example', 'Tips', 'Practice'])
  })

  it('opens on a lesson page that is a brief, not the whole article', async () => {
    await openTab('Lesson')
    assert.ok(text().includes('What these questions ask'))
    assert.ok(text().includes('How to think about them'))
    assert.ok(text().includes('step method'))
    // The old cover dumped prompt samples and watch-outs onto the first screen.
    assert.ok(!text().includes('What costs students points'))
    assert.ok(!text().includes('The prompt will look like one of these'))
  })

  it('shows a numbered method with one line per step', async () => {
    await openTab('Lesson')
    const steps = all('.lesson-step')
    assert.ok(steps.length >= 3, `expected 3+ steps, got ${steps.length}`)
    steps.forEach((step) => {
      assert.ok((step.querySelector('h3')?.textContent ?? '').length > 0)
      assert.ok((step.querySelector('p')?.textContent ?? '').length > 0)
    })
  })

  it('keeps the trimmed detail one click away rather than deleting it', async () => {
    await openTab('Lesson')
    const more = all('.lesson-more')
    assert.ok(more.length >= 1, 'no disclosure for the long version')
    assert.ok((more[0].textContent ?? '').length > 200)
  })

  it('hides the choices until the student writes a test phrase', async () => {
    await openTab('Worked example')
    const choices = container.querySelector('.lesson-choices')
    assert.ok(choices)
    assert.ok(choices.className.includes('is-locked'), 'choices were not locked')
    assert.ok(text().includes('Write your test phrase'))

    await click(byText('.button', 'Show the choices'))
    const unlocked = container.querySelector('.lesson-choices')
    assert.ok(unlocked && !unlocked.className.includes('is-locked'))
  })

  it('lets the student cross a choice out and put it back', async () => {
    await openTab('Worked example')
    if (container.querySelector('.lesson-choices')?.className.includes('is-locked')) {
      await click(byText('.button', 'Show the choices'))
    }
    const strike = all('.lesson-strike')[0]
    await click(strike)
    assert.equal(all('.lesson-choice.is-struck').length, 1)
    await click(all('.lesson-strike')[0])
    assert.equal(all('.lesson-choice.is-struck').length, 0)
  })

  it('grades a chosen answer', async () => {
    await openTab('Worked example')
    if (container.querySelector('.lesson-choices')?.className.includes('is-locked')) {
      await click(byText('.button', 'Show the choices'))
    }
    await click(all('.lesson-choice')[0])
    await click(byText('.button', 'Check my answer'))
    const verdict = container.querySelector('.lesson-explanation__verdict')
    assert.ok(verdict, 'no verdict after checking')
    assert.match(verdict.textContent ?? '', /Correct|Not quite|The answer is/)
  })

  it('puts skill tips in numbered cards and the general tips behind a disclosure', async () => {
    await openTab('Tips')
    const tips = all('.lesson-tip')
    assert.ok(tips.length >= 1, 'no tip cards')
    // Every tip is titled, numbered, and counts up from one.
    tips.forEach((tip, index) => {
      assert.ok((tip.querySelector('h3')?.textContent ?? '').length > 0, 'untitled tip')
      assert.equal(
        tip.querySelector('.lesson-tip__n')?.textContent,
        String(index + 1).padStart(2, '0'),
      )
    })
    assert.ok(text().includes('Tips that work on any Reading & Writing question'))
    // The "try it on these examples" pointer belongs at the bottom, not as a
    // card in the middle of the tips.
    assert.ok(!text().includes('Can you use any of the top tips above'))
    assert.ok(text().includes('Can you use any of the tips above on the worked example'))
  })

  it('shows exactly one worked example', async () => {
    await openTab('Worked example')
    assert.equal(all('.lesson-worked').length, 1)
    assert.equal(all('.lesson-example__pager').length, 0)
  })

  it('finishes from the Practice tab, with no way back into the lesson', async () => {
    await openTab('Practice')
    assert.ok(text().includes('Practice: Command of Evidence'))
    assert.ok(!text().includes('Re-read the lesson'))
    const before = finished
    await click(byText('.button', 'Start the mini quiz'))
    assert.equal(finished, before + 1)
  })

  it('does not offer a dead-end forward button on the last tab', async () => {
    await openTab('Practice')
    const forward = all('.lesson-actions .button')
    assert.equal(forward.length, 0, 'Practice is the last tab')
  })

  it('uses a requirement-specific scratchpad for Rhetorical Synthesis', async () => {
    await renderLesson('Rhetorical Synthesis')
    await openTab('Worked example')

    assert.ok(text().includes('State the requirement'))
    assert.ok(text().includes('Turn the goal into a checklist before you read the choices.'))
    const input = container.querySelector('.lesson-gate__input') as HTMLInputElement | null
    assert.ok(input)
    assert.equal(input.placeholder, 'e.g. must say what most fish do AND what this one does')
    assert.equal(input.getAttribute('aria-label'), 'Your requirement')

    await fillInput(input, 'must contrast the snailfish with most fish')
    await click(byText('.button', 'Show the choices'))
    assert.ok(text().includes('Your requirement: must contrast the snailfish with most fish'))
  })
})
