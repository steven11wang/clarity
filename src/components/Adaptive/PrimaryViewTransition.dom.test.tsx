import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { JSDOM } from 'jsdom'

import type { PrimaryConsoleView } from './primaryViewTransition.ts'

const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  },
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
globals.IS_REACT_ACT_ENVIRONMENT = true

const { createElement } = await import('react')
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { PrimaryViewTransition } = await import('./PrimaryViewTransition.tsx')

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)
const panels = {
  practice: createElement('p', null, 'Practice panel'),
  library: createElement('p', null, 'Library panel'),
  insights: createElement('p', null, 'Insights panel'),
}

async function render(activeView: PrimaryConsoleView) {
  await act(async () => {
    root.render(createElement(PrimaryViewTransition, { activeView, panels }))
  })
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400))
  })
}

before(async () => {
  await render('practice')
})

after(() => {
  act(() => root.unmount())
})

describe('primary view transition', () => {
  it('shows the initial panel as one settled layer', () => {
    assert.equal(
      container.querySelectorAll('.console-primary-layer').length,
      1,
    )
    assert.match(container.textContent ?? '', /Practice panel/)
  })

  it('keeps outgoing and incoming panels during a forward handoff', async () => {
    await render('library')

    const transition = container.querySelector(
      '.console-primary-transition',
    )
    assert.equal(transition?.getAttribute('data-direction'), 'forward')
    assert.equal(
      container.querySelectorAll('.console-primary-layer').length,
      2,
    )
    assert.match(container.textContent ?? '', /Practice panel/)
    assert.match(container.textContent ?? '', /Library panel/)

    await settle()

    assert.equal(
      container.querySelectorAll('.console-primary-layer').length,
      1,
    )
    assert.equal(container.textContent, 'Library panel')
  })

  it('settles on the latest request after rapid navigation', async () => {
    await render('insights')
    await render('practice')

    const transition = container.querySelector(
      '.console-primary-transition',
    )
    assert.equal(transition?.getAttribute('data-direction'), 'backward')

    await settle()

    assert.equal(container.textContent, 'Practice panel')
    assert.equal(
      container.querySelectorAll('.console-primary-layer').length,
      1,
    )
  })
})
