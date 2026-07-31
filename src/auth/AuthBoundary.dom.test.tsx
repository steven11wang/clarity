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
const { AccountChooser, LocalProfileGate, SignIn } = await import('./AuthBoundary.tsx')
const { setProfilePin } = await import('./profileShortcuts.ts')

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)

async function waitForContent(pattern: RegExp) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (pattern.test(container.textContent ?? '')) return
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2))
    })
  }
  assert.match(container.textContent ?? '', pattern)
}

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

  it('keeps a protected learner locked after a wrong PIN and opens after the correct PIN', async () => {
    dom.window.sessionStorage.clear()
    dom.window.localStorage.clear()
    dom.window.localStorage.setItem('clarity-profile-shortcuts-v1', JSON.stringify([
      { id: 'local-ada', email: 'ada@example.com', displayName: 'Ada', avatarId: 'spark' },
    ]))
    await setProfilePin('local-ada', '2468')

    await act(async () => {
      root.render(createElement(LocalProfileGate, { key: 'protected-profile', children: createElement('p', null, 'Dashboard') }))
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Continue as Ada"]')?.click()
    })

    const pinInput = container.querySelector<HTMLInputElement>('[aria-label="PIN for Ada"]')
    assert.ok(pinInput)
    assert.doesNotMatch(container.textContent ?? '', /Dashboard/)

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(pinInput, '0000')
      pinInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-profile-pin-submit]')?.click()
    })

    await waitForContent(/That PIN doesn’t match/)
    assert.match(container.textContent ?? '', /That PIN doesn’t match/)
    assert.doesNotMatch(container.textContent ?? '', /Dashboard/)

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(pinInput, '2468')
      pinInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-profile-pin-submit]')?.click()
    })

    await waitForContent(/Dashboard/)
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

  it('opens the dashboard path when the remembered profile matches the live session', async () => {
    dom.window.localStorage.clear()
    dom.window.localStorage.setItem('clarity-profile-shortcuts-v1', JSON.stringify([
      { id: 'account-ada', email: 'ada@example.com', displayName: 'Ada', avatarId: 'spark' },
    ]))
    let unlocked = false

    await act(async () => {
      root.render(
        <AccountChooser
          activeUserId="account-ada"
          onUnlock={() => { unlocked = true }}
        />,
      )
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Continue as Ada"]')?.click()
    })

    assert.equal(unlocked, true)
    assert.equal(container.querySelector('input[type="password"]'), null)
  })

  it('prefills sign-in when the remembered account has no matching live session', async () => {
    dom.window.localStorage.clear()
    dom.window.localStorage.setItem('clarity-profile-shortcuts-v1', JSON.stringify([
      { id: 'account-ada', email: 'ada@example.com', displayName: 'Ada', avatarId: 'spark' },
    ]))

    await act(async () => {
      root.render(<AccountChooser activeUserId={null} />)
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Continue as Ada"]')?.click()
    })

    const emailInput = container.querySelector<HTMLInputElement>('input[type="email"]')
    assert.ok(emailInput)
    assert.equal(emailInput.value, 'ada@example.com')
    assert.ok(container.querySelector('input[type="password"]'))
  })

  it('returns from another account sign-in to every remembered profile', async () => {
    dom.window.localStorage.clear()
    dom.window.localStorage.setItem('clarity-profile-shortcuts-v1', JSON.stringify([
      { id: 'account-steven', email: 'steven@example.com', displayName: 'steven', avatarId: 'wave' },
      { id: 'account-wang', email: 'wang@example.com', displayName: '王恒', avatarId: 'wave' },
    ]))

    await act(async () => {
      root.render(<AccountChooser key="two-account-chooser" activeUserId="account-steven" />)
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Continue as 王恒"]')?.click()
    })
    assert.equal(container.querySelector<HTMLInputElement>('input[type="email"]')?.value, 'wang@example.com')

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.auth-back')?.click()
    })

    assert.ok(container.querySelector('[aria-label="Continue as steven"]'))
    assert.ok(container.querySelector('[aria-label="Continue as 王恒"]'))
    assert.match(container.textContent ?? '', /Add User/)
  })
})
