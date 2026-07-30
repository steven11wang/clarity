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
const { LocalProfileGate, SignIn } = await import('./AuthBoundary.tsx')

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)

before(async () => {
  dom.window.sessionStorage.clear()
  await act(async () => {
    root.render(createElement(LocalProfileGate, { children: null }))
  })
})

after(() => {
  act(() => root.unmount())
})

describe('first-time local profile chooser', () => {
  it('shows only Add User and opens the existing sign-up flow', async () => {
    assert.match(container.textContent ?? '', /Add User/)
    assert.doesNotMatch(container.textContent ?? '', /Dara/)

    const addUser = container.querySelector<HTMLButtonElement>('.profile-gate__add')
    assert.ok(addUser)

    await act(async () => {
      addUser.click()
    })

    assert.match(container.textContent ?? '', /Create your account\./)
  })
})

describe('remembered local profile chooser', () => {
  it('shows a saved learner beside Add User and opens their dashboard without a PIN', async () => {
    dom.window.sessionStorage.clear()
    dom.window.localStorage.clear()
    dom.window.localStorage.setItem('clarity-profile-shortcuts-v1', JSON.stringify([
      { id: 'local-ada', email: 'ada@example.com', displayName: 'Ada', avatarId: 'spark' },
    ]))

    await act(async () => {
      root.render(createElement(LocalProfileGate, { key: 'remembered-profile', children: createElement('p', null, 'Dashboard') }))
    })

    const profile = container.querySelector<HTMLButtonElement>('[aria-label="Continue as Ada"]')
    assert.ok(profile)
    assert.match(container.textContent ?? '', /Add User/)

    await act(async () => {
      profile.click()
    })

    assert.match(container.textContent ?? '', /Dashboard/)
  })
})

describe('configured profile chooser', () => {
  it('shows only Add User and opens sign-up without Dara', async () => {
    await act(async () => {
      root.render(createElement(SignIn))
    })

    assert.match(container.textContent ?? '', /Add User/)
    assert.doesNotMatch(container.textContent ?? '', /Dara/)

    const addUser = container.querySelector<HTMLButtonElement>('.profile-gate__add')
    assert.ok(addUser)

    await act(async () => {
      addUser.click()
    })

    assert.match(container.textContent ?? '', /Create your account\./)
  })
})
