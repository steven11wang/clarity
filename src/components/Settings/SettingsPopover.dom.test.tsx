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
globals.IS_REACT_ACT_ENVIRONMENT = true

const { createElement, useState } = await import('react')
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { AuthProfileProvider } = await import('../../auth/AuthContext.tsx')
const { SettingsPopover } = await import('./SettingsPopover.tsx')

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)
let savedPin = ''
let removedPin = false

function Harness() {
  const [hasProfilePin, setHasProfilePin] = useState(false)
  return createElement(
    AuthProfileProvider,
    {
      value: {
        email: 'ada@example.com',
        displayName: 'Ada',
        isLocal: false,
        signOut: null,
        openAccount: () => {},
        profileId: 'account-ada',
        avatarId: 'spark',
        updateAvatar: null,
        hasProfilePin,
        setProfilePin: async (pin: string) => {
          savedPin = pin
          setHasProfilePin(true)
        },
        clearProfilePin: () => {
          removedPin = true
          setHasProfilePin(false)
        },
      },
      children: createElement(SettingsPopover, { onScoreUpdate: () => {} }),
    },
  )
}

function setInput(label: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)
  assert.ok(input)
  const valueSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set
  valueSetter?.call(input, value)
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
}

before(async () => {
  await act(async () => {
    root.render(createElement(Harness))
  })
})

after(() => {
  act(() => root.unmount())
})

describe('profile PIN settings', () => {
  it('enables and removes a device-only profile PIN', async () => {
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Settings"]')?.click()
    })
    const profilePinButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Profile PIN'))
    assert.ok(profilePinButton)
    await act(async () => profilePinButton.click())

    await act(async () => {
      setInput('New profile PIN', '2468')
      setInput('Confirm profile PIN', '2468')
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-profile-pin-save]')?.click()
    })

    assert.equal(savedPin, '2468')
    assert.match(container.textContent ?? '', /PIN enabled/)
    assert.match(container.textContent ?? '', /stays on this device/i)

    await act(async () => profilePinButton.click())
    const removeButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Remove PIN'))
    assert.ok(removeButton)
    await act(async () => removeButton.click())

    assert.equal(removedPin, true)
    assert.match(container.textContent ?? '', /No PIN/)
  })
})
