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
globals.localStorage = dom.window.localStorage
globals.IS_REACT_ACT_ENVIRONMENT = true

const { createElement } = await import('react')
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { PrimaryViewTransition } = await import('./PrimaryViewTransition.tsx')
const { ProgressDashboard } = await import('./ProgressDashboard.tsx')
const { Browse } = await import('../Browse/Browse.tsx')
const { Dashboard } = await import('../Dashboard/Dashboard.tsx')

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)
const panels = {
  practice: createElement('p', null, 'Practice panel'),
  exam: createElement('p', null, 'Exam panel'),
  lessons: createElement('p', null, 'Lessons panel'),
  reviews: createElement('p', null, 'Reviews panel'),
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

describe('persistent console shell', () => {
  it('keeps the scene and header mounted while the active primary panel changes', async () => {
    const shellContainer = dom.window.document.createElement('div')
    dom.window.document.body.append(shellContainer)
    const shellRoot = createRoot(shellContainer)
    const cards = [{
      domain: 'Information and Ideas' as const,
      characterStage: 'Noobie' as const,
      currentLevel: 'Noobie' as const,
      completedSkills: 1,
      totalSkills: 4,
      checkpointStatus: '3 skills to go',
      recommended: true,
      chosen: true,
      finished: false,
    }]

    async function renderShell(activeView: PrimaryConsoleView) {
      await act(async () => {
        shellRoot.render(createElement(ProgressDashboard, {
          activeView,
          examPanel: createElement('p', null, 'Embedded exam'),
          lessonsPanel: createElement('p', null, 'Embedded lessons'),
          reviewsPanel: createElement('p', null, 'Embedded reviews'),
          libraryPanel: createElement('p', null, 'Embedded library'),
          insightsPanel: createElement('p', null, 'Embedded insights'),
          cards,
          onSelectDomain: () => {},
          onUpdateScore: () => {},
          onOpenPractice: () => {},
          onOpenExam: () => {},
          onOpenLessons: () => {},
          onOpenReviews: () => {},
          onOpenLibrary: () => {},
          onOpenInsights: () => {},
        }))
      })
    }

    await renderShell('practice')
    const sceneBefore = shellContainer.querySelector('.console-hero-wash')
    const headerBefore = shellContainer.querySelector('.console-header')
    const wordmark = shellContainer.querySelector('.console-wordmark')

    assert.equal(wordmark?.tagName, 'BUTTON')
    assert.equal(wordmark?.getAttribute('aria-label'), 'Open Practice home')

    await renderShell('lessons')

    assert.equal(shellContainer.querySelector('.console-hero-wash'), sceneBefore)
    assert.equal(shellContainer.querySelector('.console-header'), headerBefore)
    assert.match(shellContainer.textContent ?? '', /Embedded lessons/)
    // Lessons lives on the practice rail now, so no nav tab claims the page.
    assert.equal(shellContainer.querySelector('[aria-current="page"]'), null)

    await renderShell('library')

    assert.equal(shellContainer.querySelector('.console-hero-wash'), sceneBefore)
    assert.equal(shellContainer.querySelector('.console-header'), headerBefore)
    assert.match(shellContainer.textContent ?? '', /Embedded library/)
    assert.equal(
      shellContainer.querySelector('[aria-current="page"]')?.textContent,
      'Library',
    )

    await renderShell('insights')

    assert.equal(shellContainer.querySelector('.console-hero-wash'), sceneBefore)
    assert.equal(shellContainer.querySelector('.console-header'), headerBefore)
    assert.match(shellContainer.textContent ?? '', /Embedded insights/)
    assert.equal(
      shellContainer.querySelector('[aria-current="page"]')?.textContent,
      'Insights',
    )
    assert.deepEqual(
      [...shellContainer.querySelectorAll('.console-nav button')].map(
        (button) => button.textContent,
      ),
      ['Practice', 'Reviews', 'Library', 'Insights'],
    )

    await act(async () => {
      shellRoot.unmount()
    })
    shellContainer.remove()
  })

  it('does not show a return-to-today action in due reviews', async () => {
    const reviewContainer = dom.window.document.createElement('div')
    dom.window.document.body.append(reviewContainer)
    const reviewRoot = createRoot(reviewContainer)
    const cards = [{
      domain: 'Information and Ideas' as const,
      characterStage: 'Noobie' as const,
      currentLevel: 'Noobie' as const,
      completedSkills: 1,
      totalSkills: 4,
      checkpointStatus: '3 skills to go',
      recommended: true,
      chosen: true,
      finished: false,
    }]

    await act(async () => {
      reviewRoot.render(createElement(ProgressDashboard, {
        activeView: 'practice',
        examPanel: createElement('p'),
        lessonsPanel: createElement('p'),
        reviewsPanel: createElement('p'),
        libraryPanel: createElement('p'),
        insightsPanel: createElement('p'),
        cards,
        onSelectDomain: () => {},
        onUpdateScore: () => {},
        onOpenPractice: () => {},
        onOpenExam: () => {},
        onOpenLessons: () => {},
        onOpenReviews: () => {},
        onOpenLibrary: () => {},
        onOpenInsights: () => {},
      }))
    })

    await act(async () => {
      ;(reviewContainer.querySelector('[aria-label="Due reviews"]') as HTMLButtonElement).click()
      await new Promise((resolve) => setTimeout(resolve, 500))
    })

    const heroButtons = [...reviewContainer.querySelectorAll('.console-hero__actions button')]
    assert.equal(heroButtons.some((button) => button.textContent === 'Return to today'), false)

    await act(async () => {
      reviewRoot.unmount()
    })
    reviewContainer.remove()
  })

  it('sends the due-reviews hero into the mistake vault, not the library', async () => {
    const heroContainer = dom.window.document.createElement('div')
    dom.window.document.body.append(heroContainer)
    const heroRoot = createRoot(heroContainer)
    const cards = [{
      domain: 'Information and Ideas' as const,
      characterStage: 'Noobie' as const,
      currentLevel: 'Noobie' as const,
      completedSkills: 1,
      totalSkills: 4,
      checkpointStatus: '3 skills to go',
      recommended: true,
      chosen: true,
      finished: false,
    }]
    let reviewsOpened = 0
    let libraryOpened = 0

    await act(async () => {
      heroRoot.render(createElement(ProgressDashboard, {
        activeView: 'practice',
        examPanel: createElement('p'),
        lessonsPanel: createElement('p'),
        reviewsPanel: createElement('p', null, 'Embedded vault'),
        libraryPanel: createElement('p'),
        insightsPanel: createElement('p'),
        cards,
        dueCount: 3,
        onSelectDomain: () => {},
        onUpdateScore: () => {},
        onOpenPractice: () => {},
        onOpenExam: () => {},
        onOpenLessons: () => {},
        onOpenReviews: () => { reviewsOpened += 1 },
        onOpenLibrary: () => { libraryOpened += 1 },
        onOpenInsights: () => {},
      }))
    })

    await act(async () => {
      ;(heroContainer.querySelector('[aria-label="Due reviews"]') as HTMLButtonElement).click()
      await new Promise((resolve) => setTimeout(resolve, 500))
    })

    const primary = heroContainer.querySelector(
      '.console-hero__actions .console-button--primary',
    ) as HTMLButtonElement
    assert.equal(primary.textContent, 'Open the mistake vault')

    await act(async () => {
      primary.click()
    })

    assert.equal(reviewsOpened, 1)
    assert.equal(libraryOpened, 0)

    // The nav tab carries the due count and lands on the vault panel.
    const reviewsTab = [...heroContainer.querySelectorAll('.console-nav button')].find(
      (button) => button.textContent?.startsWith('Reviews'),
    ) as HTMLButtonElement
    assert.equal(reviewsTab.textContent, 'Reviews (3)')

    await act(async () => {
      heroRoot.unmount()
    })
    heroContainer.remove()
  })
})

describe('embedded primary panels', () => {
  it('renders Library and Insights without standalone page headers', async () => {
    const panelContainer = dom.window.document.createElement('div')
    dom.window.document.body.append(panelContainer)
    const panelRoot = createRoot(panelContainer)

    await act(async () => {
      panelRoot.render(createElement(Browse, {
        embedded: true,
        questions: [],
        dueCount: 0,
        timedMode: false,
        timeLimitSec: 90,
        onToggleTimed: () => {},
        onChangeLimit: () => {},
        onStart: () => {},
        onOpenDashboard: () => {},
      }))
    })

    assert.ok(panelContainer.querySelector('.browse--embedded'))
    assert.equal(panelContainer.querySelector('.app-header'), null)
    assert.equal(panelContainer.querySelector('main'), null)

    await act(async () => {
      panelRoot.render(createElement(Dashboard, {
        embedded: true,
        onBack: () => {},
      }))
    })

    assert.ok(panelContainer.querySelector('.dashboard--embedded'))
    assert.equal(panelContainer.querySelector('.app-header'), null)
    assert.equal(panelContainer.querySelector('main'), null)

    await act(async () => {
      panelRoot.unmount()
    })
    panelContainer.remove()
  })
})
