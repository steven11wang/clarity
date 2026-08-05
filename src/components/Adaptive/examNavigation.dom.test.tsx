import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { JSDOM } from 'jsdom'
import type { DomainCardView } from './ProgressDashboard.tsx'

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
const { ProgressDashboard } = await import('./ProgressDashboard.tsx')

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)

const cards: DomainCardView[] = [{
  domain: 'Information and Ideas',
  characterStage: 'Noobie',
  currentLevel: 'Noobie',
  completedSkills: 0,
  totalSkills: 1,
  checkpointStatus: 'Checkpoint ready',
  recommended: true,
  chosen: true,
  finished: false,
}]

let examOpens = 0

function render(activeView: 'practice' | 'exam') {
  return act(async () => {
    root.render(createElement(ProgressDashboard, {
      activeView,
      examPanel: createElement('p', null, 'Practice exam panel'),
      lessonsPanel: createElement('p', null, 'Lessons panel'),
      reviewsPanel: null,
      libraryPanel: null,
      insightsPanel: null,
      cards,
      onSelectDomain: () => {},
      onUpdateScore: () => {},
      onOpenPractice: () => {},
      onOpenExam: () => { examOpens += 1 },
      onOpenLessons: () => {},
      onOpenReviews: () => {},
      onOpenLibrary: () => {},
      onOpenInsights: () => {},
    }))
  })
}

function railTile(label: string) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('.console-tile'),
  ).find((button) => button.getAttribute('aria-label') === label)
}

function heroButton(label: string) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('.console-hero__actions button'),
  ).find((button) => button.textContent === label)
}

before(async () => {
  await render('practice')
})

after(() => {
  act(() => root.unmount())
})

describe('practice exam navigation', () => {
  it('lives inside Practice rather than beside it in the top nav', async () => {
    const labels = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.console-nav button'),
    ).map((button) => button.textContent)

    assert.deepEqual(labels, ['Practice', 'Library', 'Insights'])
    assert.ok(railTile('Practice exam'))
  })

  it('opens the exam from the practice rail hero', async () => {
    const tile = railTile('Practice exam')
    assert.ok(tile)

    await act(async () => tile.click())
    // The hero copy swaps behind a short transition.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600))
    })

    const open = heroButton('Open practice exam')
    assert.ok(open)

    await act(async () => open.click())

    assert.equal(examOpens, 1)
  })

  it('keeps the Practice tab current and shows the exam panel in that view', async () => {
    await render('exam')

    const practiceTab = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.console-nav button'),
    ).find((button) => button.textContent === 'Practice')
    assert.ok(practiceTab)
    assert.equal(practiceTab.getAttribute('aria-current'), 'page')
    assert.ok(container.textContent?.includes('Practice exam panel'))
  })
})
