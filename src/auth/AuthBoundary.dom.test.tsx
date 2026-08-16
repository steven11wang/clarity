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
globals.sessionStorage = dom.window.sessionStorage
globals.IS_REACT_ACT_ENVIRONMENT = true
const React = await import('react')
globals.React = React

const { createElement } = React
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { AccountChooser, LocalProfileGate, SignIn } = await import('./AuthBoundary.tsx')
const { SignInPage } = await import('./SignInPage.tsx')

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
  dom.window.localStorage.clear()
})

after(() => {
  act(() => root.unmount())
})

describe('Mountain Path Sign-In Page', () => {
  it('renders the brandmark seal, welcome back title, practice subtitle, inputs, and Google button', async () => {
    await act(async () => {
      root.render(createElement(SignInPage, { key: 'main-render' }))
    })

    assert.match(container.textContent ?? '', /CLARITY/)
    assert.match(container.textContent ?? '', /Welcome back/)
    assert.match(container.textContent ?? '', /Continue your practice\./)
    assert.match(container.textContent ?? '', /Email/)
    assert.match(container.textContent ?? '', /Password/)
    assert.match(container.textContent ?? '', /Forgot password\?/)
    assert.match(container.textContent ?? '', /Sign in/)
    assert.match(container.textContent ?? '', /Continue with Google/)
    assert.match(container.textContent ?? '', /New to Clarity\?/)
    assert.match(container.textContent ?? '', /Create an account/)

    const seal = container.querySelector<SVGElement>('.auth-brandmark-seal')
    assert.ok(seal)

    const emailInput = container.querySelector<HTMLInputElement>('input[type="email"]')
    assert.ok(emailInput)
    assert.equal(emailInput.placeholder, 'name@example.com')

    const passwordInput = container.querySelector<HTMLInputElement>('input[type="password"]')
    assert.ok(passwordInput)
    assert.equal(passwordInput.placeholder, '••••••••••••')

    const googleBtn = container.querySelector<HTMLButtonElement>('.auth-google-btn')
    assert.ok(googleBtn)
  })

  it('allows toggling password visibility and switching to sign up or forgot password modes', async () => {
    await act(async () => {
      root.render(createElement(SignInPage, { key: 'mode-switch-test' }))
    })

    const eyeBtn = container.querySelector<HTMLButtonElement>('.auth-eye-btn')
    assert.ok(eyeBtn)

    await act(async () => {
      eyeBtn.click()
    })

    const revealedInput = container.querySelector<HTMLInputElement>('input[type="text"]')
    assert.ok(revealedInput)

    const signUpLink = Array.from(container.querySelectorAll<HTMLButtonElement>('.auth-switch-link'))
      .find((b) => b.textContent?.includes('Create an account'))
    assert.ok(signUpLink)

    await act(async () => {
      signUpLink.click()
    })

    assert.match(container.textContent ?? '', /Create an account/)
    assert.match(container.textContent ?? '', /Start your practice today\./)
    assert.match(container.textContent ?? '', /Create account/)

    const signInLink = Array.from(container.querySelectorAll<HTMLButtonElement>('.auth-switch-link'))
      .find((b) => b.textContent?.includes('Sign in'))
    assert.ok(signInLink)

    await act(async () => {
      signInLink.click()
    })

    assert.match(container.textContent ?? '', /Welcome back/)

    const forgotBtn = container.querySelector<HTMLButtonElement>('.auth-forgot-link')
    assert.ok(forgotBtn)

    await act(async () => {
      forgotBtn.click()
    })

    assert.match(container.textContent ?? '', /Reset password/)
    assert.match(container.textContent ?? '', /Send reset link/)
  })

  it('triggers Google login and calls onSuccess in local mode', async () => {
    let chosenProfile: unknown = null
    await act(async () => {
      root.render(
        createElement(SignInPage, {
          key: 'google-login-test',
          onSuccess: (profile) => {
            chosenProfile = profile
          },
        }),
      )
    })

    const googleBtn = container.querySelector<HTMLButtonElement>('.auth-google-btn')
    assert.ok(googleBtn)

    await act(async () => {
      googleBtn.click()
    })

    assert.ok(chosenProfile)
    assert.equal((chosenProfile as { email: string }).email, 'learner@gmail.com')
  })

  it('allows email entry and transitions directly on submit', async () => {
    let chosenProfile: unknown = null
    await act(async () => {
      root.render(
        createElement(SignInPage, {
          key: 'email-login-test',
          onSuccess: (profile) => {
            chosenProfile = profile
          },
        }),
      )
    })

    const emailInput = container.querySelector<HTMLInputElement>('input[type="email"]')
    assert.ok(emailInput)

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(emailInput, 'ada@example.com')
      emailInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })

    const submitBtn = container.querySelector<HTMLButtonElement>('button[type="submit"]')
    assert.ok(submitBtn)

    await act(async () => {
      submitBtn.click()
    })

    assert.ok(chosenProfile)
    assert.equal((chosenProfile as { email: string }).email, 'ada@example.com')
    assert.equal((chosenProfile as { displayName: string }).displayName, 'Ada')
  })

  it('renders initialError when provided', async () => {
    await act(async () => {
      root.render(
        createElement(SignInPage, {
          key: 'initial-error-test',
          initialError: 'Google authentication failed (server_error).',
        }),
      )
    })

    assert.match(container.textContent ?? '', /Google authentication failed \(server_error\)/)
  })
})

describe('LocalProfileGate Flow', () => {
  it('shows SignInPage initially and opens dashboard on successful sign-in', async () => {
    dom.window.sessionStorage.clear()
    dom.window.localStorage.clear()

    await act(async () => {
      root.render(
        createElement(LocalProfileGate, {
          key: 'local-gate-test',
          children: createElement('div', { id: 'dashboard-view' }, 'Welcome to Dashboard'),
        }),
      )
    })

    assert.match(container.textContent ?? '', /Welcome back/)
    assert.doesNotMatch(container.textContent ?? '', /Welcome to Dashboard/)

    const emailInput = container.querySelector<HTMLInputElement>('input[type="email"]')
    assert.ok(emailInput)

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(emailInput, 'steven@example.com')
      emailInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })

    const submitBtn = container.querySelector<HTMLButtonElement>('button[type="submit"]')
    assert.ok(submitBtn)

    await act(async () => {
      submitBtn.click()
    })

    await waitForContent(/Welcome to Dashboard/)
    assert.match(container.textContent ?? '', /Welcome to Dashboard/)
  })
})
