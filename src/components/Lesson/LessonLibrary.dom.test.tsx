import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { JSDOM } from 'jsdom'

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
globals.localStorage = dom.window.localStorage
globals.IS_REACT_ACT_ENVIRONMENT = true

const { createElement } = await import('react')
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { LessonLibrary } = await import('./LessonLibrary.tsx')

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)
let selectedSkill = ''

async function click(element: Element | null) {
  assert.ok(element)
  await act(async () => {
    element.dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true }),
    )
  })
}

before(async () => {
  await act(async () => {
    root.render(
      createElement(LessonLibrary, {
        recommendedSkill: 'Command of Evidence',
        onSelectSkill: (skill: string) => {
          selectedSkill = skill
        },
        onBack: () => {},
      }),
    )
  })
})

after(() => {
  act(() => root.unmount())
})

describe('lessons console landing', () => {
  it('opens as an embedded five-tile console rail', () => {
    assert.equal(container.querySelectorAll('.adaptive-header').length, 0)
    assert.equal(container.querySelectorAll('.lesson-console__tile').length, 5)
    assert.match(
      container.querySelector(
        '.lesson-console__tile[aria-pressed="true"]',
      )?.textContent ?? '',
      /Continue learning/,
    )
    assert.match(container.textContent ?? '', /Command of Evidence/)
  })

  it('filters the detail list by domain', async () => {
    await click(
      container.querySelector(
        '.lesson-console__tile[data-domain="Craft and Structure"]',
      ),
    )

    const rows = [
      ...container.querySelectorAll('.lesson-console__lesson-row'),
    ]
    assert.ok(rows.length > 0)
    rows.forEach((row) => {
      assert.equal(row.getAttribute('data-domain'), 'Craft and Structure')
    })
  })

  it('opens the selected lesson', async () => {
    const row = container.querySelector('.lesson-console__lesson-row')
    await click(row)
    assert.equal(selectedSkill, row?.getAttribute('data-skill'))
  })
})
