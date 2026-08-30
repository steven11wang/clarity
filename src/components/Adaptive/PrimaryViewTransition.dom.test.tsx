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
  words: createElement('p', null, 'Words panel'),
  library: createElement('p', null, 'Library panel'),
  reflect: createElement('p', null, 'Reflect panel'),
  arena: createElement('p', null, 'Arena panel'),
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
    await render('reflect')

    const transition = container.querySelector(
      '.console-primary-transition',
    )
    assert.equal(transition?.getAttribute('data-direction'), 'forward')
    assert.equal(
      container.querySelectorAll('.console-primary-layer').length,
      2,
    )
    assert.match(container.textContent ?? '', /Practice panel/)
    assert.match(container.textContent ?? '', /Reflect panel/)

    await settle()

    assert.equal(
      container.querySelectorAll('.console-primary-layer').length,
      1,
    )
    assert.equal(container.textContent, 'Reflect panel')
  })

  it('settles on the latest request after rapid navigation', async () => {
    await render('words')
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
          wordsPanel: createElement('p', null, 'Embedded words'),
          libraryPanel: createElement('p', null, 'Embedded library'),
          reflectPanel: createElement('p', null, 'Embedded reflect'),
          arenaPanel: createElement('p'),
          cards,
          onSelectDomain: () => {},
          onUpdateScore: () => {},
          onOpenPractice: () => {},
          onOpenExam: () => {},
          onOpenLessons: () => {},
          onOpenWords: () => {},
          onOpenLibrary: () => {},
          onOpenReflect: () => {},
          onOpenArena: () => {},
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
    // Lessons is the first shelf of the Learn tab, so Learn claims the page.
    assert.equal(
      shellContainer.querySelector('[aria-current="page"]')?.textContent,
      'Learn',
    )

    await renderShell('library')

    assert.equal(shellContainer.querySelector('.console-hero-wash'), sceneBefore)
    assert.equal(shellContainer.querySelector('.console-header'), headerBefore)
    assert.match(shellContainer.textContent ?? '', /Embedded library/)
    // The Library shelf is under Learn too; the sub-nav names it, not the tab.
    assert.equal(
      shellContainer.querySelector('[aria-current="page"]')?.textContent,
      'Learn',
    )
    // Both Learn layers are on screen mid-slide, so look for the shelf rather
    // than assuming the incoming layer comes first in the DOM.
    assert.ok(
      [...shellContainer.querySelectorAll('.console-subnav__active')].some(
        (button) => button.textContent === 'Library',
      ),
    )

    await renderShell('reflect')

    assert.equal(shellContainer.querySelector('.console-hero-wash'), sceneBefore)
    assert.equal(shellContainer.querySelector('.console-header'), headerBefore)
    assert.match(shellContainer.textContent ?? '', /Embedded reflect/)
    assert.equal(
      shellContainer.querySelector('[aria-current="page"]')?.textContent,
      'Reflect',
    )
    // Insights was folded into Reflect, so the nav is four tabs wide.
    assert.deepEqual(
      [...shellContainer.querySelectorAll('.console-nav button')].map(
        (button) => button.textContent,
      ),
      ['Learn', 'Practice', 'Reflect', 'Arena', 'Words'],
    )

    await act(async () => {
      shellRoot.unmount()
    })
    shellContainer.remove()
  })

  // The vault moved to Reflect, so Practice should offer no way into it: no
  // rail tile, no status-row shortcut. Two doors to one screen was the reason
  // it read as a drilling surface rather than part of the record.
  it('leaves the mistake vault out of the practice console', async () => {
    const railContainer = dom.window.document.createElement('div')
    dom.window.document.body.append(railContainer)
    const railRoot = createRoot(railContainer)
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
      railRoot.render(createElement(ProgressDashboard, {
        activeView: 'practice',
        examPanel: createElement('p'),
        lessonsPanel: createElement('p'),
        reviewsPanel: createElement('p'),
        wordsPanel: createElement('p'),
        libraryPanel: createElement('p'),
        reflectPanel: createElement('p'),
        arenaPanel: createElement('p'),
        cards,
        onSelectDomain: () => {},
        onUpdateScore: () => {},
        onOpenPractice: () => {},
        onOpenExam: () => {},
        onOpenLessons: () => {},
        onOpenWords: () => {},
        onOpenLibrary: () => {},
        onOpenReflect: () => {},
        onOpenArena: () => {},
      }))
    })

    assert.equal(railContainer.querySelector('[aria-label="Due reviews"]'), null)
    const vaultShortcut = [...railContainer.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Review practice'),
    )
    assert.equal(vaultShortcut, undefined)

    await act(async () => {
      railRoot.unmount()
    })
    railContainer.remove()
  })

  it('offers Arena in the nav, directly after Reflect', async () => {
    const navContainer = dom.window.document.createElement('div')
    dom.window.document.body.append(navContainer)
    const navRoot = createRoot(navContainer)
    let arenaOpened = 0
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
      navRoot.render(createElement(ProgressDashboard, {
        activeView: 'practice',
        examPanel: createElement('p'),
        lessonsPanel: createElement('p'),
        reviewsPanel: createElement('p'),
        wordsPanel: createElement('p'),
        libraryPanel: createElement('p'),
        reflectPanel: createElement('p'),
        arenaPanel: createElement('p'),
        cards,
        onSelectDomain: () => {},
        onUpdateScore: () => {},
        onOpenPractice: () => {},
        onOpenExam: () => {},
        onOpenLessons: () => {},
        onOpenWords: () => {},
        onOpenLibrary: () => {},
        onOpenReflect: () => {},
        onOpenArena: () => { arenaOpened += 1 },
      }))
    })

    const navLabels = [...navContainer.querySelectorAll('.console-nav button')].map(
      (button) => button.textContent,
    )
    assert.deepEqual(navLabels, ['Learn', 'Practice', 'Reflect', 'Arena', 'Words'])

    const arena = [...navContainer.querySelectorAll<HTMLButtonElement>('.console-nav button')].find(
      (button) => button.textContent === 'Arena',
    )!
    await act(async () => {
      arena.click()
    })
    assert.equal(arenaOpened, 1)

    await act(async () => {
      navRoot.unmount()
    })
    navContainer.remove()
  })
})

describe('embedded primary panels', () => {
  it('renders Library and the error record without standalone page headers', async () => {
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
