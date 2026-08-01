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
  it('opens with the recommended domain selected across four portals', () => {
    assert.equal(container.querySelectorAll('.adaptive-header').length, 0)
    assert.equal(container.querySelectorAll('.lesson-portal-door').length, 4)
    assert.equal(
      container
        .querySelector('.lesson-portal-door[aria-pressed="true"]')
        ?.getAttribute('data-domain'),
      'Information and Ideas',
    )
    assert.ok(container.querySelector('.lesson-portal-room__continue'))
  })

  it('walks portal → skill list → lesson', async () => {
    const door = () =>
      container.querySelector(
        '.lesson-portal-door[data-domain="Craft and Structure"]',
      )

    // First click only selects the door: the room stays put.
    await click(door())
    assert.equal(container.querySelectorAll('.lesson-portal-door').length, 4)
    assert.equal(door()?.getAttribute('aria-pressed'), 'true')
    assert.match(
      container.querySelector('.lesson-portal-room__title')?.textContent ?? '',
      /Craft and Structure/,
    )

    // The second click on the selected door walks through it.
    await click(door())

    // The hall lists every skill in that domain before anything starts.
    assert.equal(container.querySelectorAll('.lesson-portal-door').length, 0)
    assert.match(
      container.querySelector('.lesson-skill-picker__title')?.textContent ?? '',
      /Craft and Structure/,
    )
    const skills = [...container.querySelectorAll('.lesson-skill-card')].map(
      (card) => card.getAttribute('data-skill'),
    )
    assert.ok(skills.length > 1)
    assert.ok(skills.includes('Words in Context'))
    assert.equal(selectedSkill, '')

    await click(
      container.querySelector('.lesson-skill-card[data-skill="Words in Context"]'),
    )
    assert.equal(selectedSkill, 'Words in Context')
  })

  it('returns to the portal room and resumes the recommended lesson', async () => {
    await click(container.querySelector('.lesson-skill-picker__back'))
    assert.equal(container.querySelectorAll('.lesson-portal-door').length, 4)
    assert.match(
      container.querySelector('.lesson-portal-room__title')?.textContent ?? '',
      /Craft and Structure/,
    )

    await click(container.querySelector('.lesson-portal-room__continue'))
    assert.equal(selectedSkill, 'Command of Evidence')
  })

  it('opens the selected hall from the hero button', async () => {
    await click(container.querySelector('.lesson-portal-room__enter'))
    assert.match(
      container.querySelector('.lesson-skill-picker__title')?.textContent ?? '',
      /Craft and Structure/,
    )
  })
})
