import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

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
const { Library } = await import('./Library.tsx')

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)

function buttonByText(label: string) {
  return [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === label,
  ) ?? null
}

function bookButton(title: string) {
  return container.querySelector(`button[aria-label^="${title}"]`)
}

async function click(element: Element | null) {
  assert.ok(element)
  await act(async () => {
    element.dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true }),
    )
  })
}

async function enterShelf() {
  await click(buttonByText('ENTER LIBRARY'))
}

before(async () => {
  await act(async () => {
    root.render(
      createElement(Library, {
        questions: [
          {
            id: 'library-test-question',
            assessment: 'test',
            test: 'test',
            domain: 'Information and Ideas',
            skill: 'Central Ideas and Details',
            difficulty: 'Easy',
            passage: 'A short passage.',
            prompt: 'Which choice is correct?',
            choices: { A: 'A', B: 'B', C: 'C', D: 'D' },
            answer: 'A',
            rationale: 'A is correct.',
          },
        ],
        dueCount: 0,
        timedMode: false,
        timeLimitSec: 90,
        onToggleTimed: () => {},
        onChangeLimit: () => {},
        onStart: () => {},
        onOpenDashboard: () => {},
      }),
    )
  })
})

after(() => {
  act(() => root.unmount())
})

describe('Library flow', () => {
  it('opens the shelf from the Library landing', async () => {
    assert.match(container.textContent ?? '', /The library\s*is open/)
    await enterShelf()
    assert.match(container.textContent ?? '', /Your library/)
    assert.match(container.textContent ?? '', /Question bank/)
  })

  it('opens a placeholder volume from the shelf', async () => {
    await click(bookButton("Master's note"))
    assert.match(container.textContent ?? '', /Pages coming soon/)
    await click(buttonByText('Close book'))
  })

  it('unlocks and opens the Question Bank', async () => {
    await click(buttonByText('TURN THE DIAL'))
    await click(buttonByText('START A SET'))
    assert.match(container.textContent ?? '', /Practice with intention/)
    await click(buttonByText('Back to library'))
    assert.match(container.textContent ?? '', /Your library/)
  })
})
