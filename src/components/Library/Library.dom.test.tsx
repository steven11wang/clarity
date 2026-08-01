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

  it("opens the Master's note with sourced entries", async () => {
    await click(bookButton("Master's note"))
    assert.match(container.textContent ?? '', /ENTRY 01 \/ 26/)
    assert.match(container.textContent ?? '', /Vocabulary sets the ceiling/)
    const source = container.querySelector('a[href*="thecollegepanda.com"]')
    assert.ok(source)
    assert.equal(source?.getAttribute('target'), '_blank')

    await click(buttonByText('Next'))
    assert.match(container.textContent ?? '', /ENTRY 02 \/ 26/)

    const tacticsTab = [...container.querySelectorAll('.library__masters-tabs button')]
      .find((button) => button.textContent?.trim() === 'TACTICS') ?? null
    await click(tacticsTab)
    assert.match(container.textContent ?? '', /ENTRY 01 \/ 05/)
    assert.match(container.textContent ?? '', /purpose questions/i)

    await click(buttonByText('Close book'))
  })

  it('opens the Resources volume with linked picks', async () => {
    await click(bookButton('Resources'))
    await click(bookButton('Resources'))
    assert.match(container.textContent ?? '', /Bluebook™ Testing App/)
    assert.match(container.textContent ?? '', /Khan Academy/)
    const link = container.querySelector('a[href*="khanacademy.org"]')
    assert.ok(link)
    assert.equal(link?.getAttribute('target'), '_blank')
    await click(buttonByText('Close book'))
  })

  it('opens the Beginner guide with chapter content', async () => {
    await click(bookButton("Beginner's guide"))
    await click(bookButton("Beginner's guide"))
    assert.match(container.textContent ?? '', /Untimed Dictionary Score/)
    assert.match(container.textContent ?? '', /Start Here/)
    await click(buttonByText('Next'))
    assert.match(container.textContent ?? '', /Build Your Vocabulary Base/)
    const chapterSix = container.querySelector(
      'button[aria-label="Chapter 6: Learning to Eliminate"]',
    )
    await click(chapterSix)
    assert.match(container.textContent ?? '', /Learning to Eliminate/)
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
