import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { JSDOM } from 'jsdom'

const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true },
)

const globals = globalThis as unknown as Record<string, unknown>
globals.window = dom.window
globals.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
globals.HTMLElement = dom.window.HTMLElement
globals.Element = dom.window.Element
globals.Node = dom.window.Node
globals.localStorage = dom.window.localStorage
globals.IS_REACT_ACT_ENVIRONMENT = true

const { createElement } = await import('react')
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { ArenaLobby } = await import('./ArenaLobby.tsx')
const { emptyProfile } = await import('../../arena/model.ts')

const container = dom.window.document.getElementById('root')!
const root = createRoot(container)

let joined: string[] = []

async function render(liveAvailable: boolean) {
  joined = []
  await act(async () => {
    root.render(
      createElement(ArenaLobby, {
        key: String(Math.random()),
        profile: emptyProfile('s1'),
        history: [],
        domains: ['Craft and Structure'],
        mode: 'ranked',
        domain: 'all',
        difficulty: 'any',
        poolCount: 100,
        liveAvailable,
        onModeChange: () => {},
        onDomainChange: () => {},
        onDifficultyChange: () => {},
        onStart: () => {},
        onInvite: () => {},
        onJoinCode: (code: string) => { joined.push(code) },
      }),
    )
  })
}

function codeButton() {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => button.textContent?.includes('friend’s code'))
}

async function typeCode(value: string) {
  const input = container.querySelector<HTMLInputElement>('#arena-join-code')!
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
}

async function submit() {
  await act(async () => {
    container.querySelector<HTMLFormElement>('.arena-join')!
      .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
  })
}

after(() => {
  act(() => root.unmount())
})

describe('Arena lobby: enter a friend’s code', () => {
  beforeEach(() => {
    joined = []
  })

  it('is disabled when live play is unavailable', async () => {
    await render(false)
    assert.equal(codeButton()?.disabled, true)
    assert.equal(container.querySelector('.arena-join'), null)
  })

  it('opens a field and joins with a pasted code', async () => {
    await render(true)
    assert.equal(container.querySelector('.arena-join'), null)

    await act(async () => codeButton()!.click())
    assert.ok(container.querySelector('.arena-join'))

    await typeCode(' k7m-2qx ')
    await submit()
    assert.deepEqual(joined, ['K7M2QX'])
  })

  it('joins from a pasted invite link', async () => {
    await render(true)
    await act(async () => codeButton()!.click())
    await typeCode('https://satclarity.com/app/?arena=ab3dxy')
    await submit()
    assert.deepEqual(joined, ['AB3DXY'])
  })

  it('refuses a malformed code and says why', async () => {
    await render(true)
    await act(async () => codeButton()!.click())
    await typeCode('nope')
    await submit()

    assert.deepEqual(joined, [])
    assert.match(container.querySelector('.arena-join__error')?.textContent ?? '', /6 letters and numbers/)

    await typeCode('K7M2QX')
    assert.equal(container.querySelector('.arena-join__error'), null)
  })
})
