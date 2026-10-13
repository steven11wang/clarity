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
const { AuthProfileProvider } = await import('../../auth/AuthContext.tsx')
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

let openAccountCalls = 0
let scoreUpdateCalls = 0
const chosenAvatars: string[] = []

before(async () => {
  await act(async () => {
    root.render(createElement(
      AuthProfileProvider,
      {
        value: {
          email: 'student@example.com',
          displayName: 'Student',
          isLocal: false,
          signOut: null,
          openAccount: () => { openAccountCalls += 1 },
          avatarId: 'clawd',
          updateAvatar: async (id: string) => { chosenAvatars.push(id) },
        },
        children: createElement(ProgressDashboard, {
          activeView: 'practice',
          examPanel: null,
          drillPanel: null,
          lessonsPanel: null,
          reviewsPanel: null,
          wordsPanel: null,
          libraryPanel: null,
          reflectPanel: null,
          arenaPanel: null,
          cards,
          onSelectDomain: () => {},
          onUpdateScore: () => { scoreUpdateCalls += 1 },
          onOpenPractice: () => {},
          onOpenDrill: () => {},
          onOpenVault: () => {},
          onOpenExam: () => {},
          onOpenLessons: () => {},
          onOpenWords: () => {},
          onOpenLibrary: () => {},
          onOpenReflect: () => {},
          onOpenArena: () => {},
        }),
      },
    ))
  })
})

after(() => {
  act(() => root.unmount())
})

describe('account navigation', () => {
  it('opens the profile pictures from the learner control without leaving the page', async () => {
    const profileButton = container.querySelector<HTMLButtonElement>('[aria-label="Profile and picture"]')
    assert.ok(profileButton)
    assert.equal(container.querySelector('.profile-popover__panel'), null)

    await act(async () => profileButton.click())

    const choices = container.querySelectorAll<HTMLButtonElement>('.profile-popover__choice')
    assert.equal(choices.length, 8)
    assert.equal(
      container.querySelector('.profile-popover__choice[aria-pressed="true"]')?.getAttribute('aria-label'),
      'Use Clawd',
    )

    const scholar = container.querySelector<HTMLButtonElement>('[aria-label="Use Scholar"]')
    assert.ok(scholar)
    await act(async () => scholar.click())

    assert.deepEqual(chosenAvatars, ['scholar'])
    assert.equal(openAccountCalls, 0)
    assert.equal(scoreUpdateCalls, 0)
  })

  it('keeps Score update on the upload flow callback', async () => {
    const settingsButton = container.querySelector<HTMLButtonElement>('[aria-label="Settings"]')
    assert.ok(settingsButton)

    await act(async () => settingsButton.click())

    const scoreUpdateButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Score update'))
    assert.ok(scoreUpdateButton)

    await act(async () => scoreUpdateButton.click())

    assert.equal(scoreUpdateCalls, 1)
    assert.equal(openAccountCalls, 0)
  })
})
