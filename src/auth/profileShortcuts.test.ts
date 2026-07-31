import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { JSDOM } from 'jsdom'

import {
  PROFILE_SHORTCUTS_KEY,
  clearProfilePin,
  listProfileShortcuts,
  setProfilePin,
  upsertProfileShortcut,
  verifyProfilePin,
} from './profileShortcuts.ts'

const dom = new JSDOM('', { url: 'http://localhost/' })
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: dom.window,
})

beforeEach(() => {
  dom.window.localStorage.clear()
})

describe('profile shortcuts', () => {
  it('normalizes saved shortcuts and discards malformed PIN data', () => {
    dom.window.localStorage.setItem(PROFILE_SHORTCUTS_KEY, JSON.stringify([
      {
        id: 'u1',
        email: 'ada@example.com',
        displayName: 'Ada',
        avatarId: 'missing',
        pin: { salt: 'salt-only' },
      },
      { id: 42, email: 'invalid@example.com', displayName: 'Invalid' },
    ]))

    assert.deepEqual(listProfileShortcuts(), [{
      id: 'u1',
      email: 'ada@example.com',
      displayName: 'Ada',
      avatarId: 'orbit',
    }])
  })

  it('verifies a correct PIN without retaining its raw value', async () => {
    upsertProfileShortcut({
      id: 'u1',
      email: 'ada@example.com',
      displayName: 'Ada',
      avatarId: 'spark',
    })

    const protectedProfile = await setProfilePin('u1', '2468')

    assert.equal(await verifyProfilePin(protectedProfile, '2468'), true)
    assert.equal(await verifyProfilePin(protectedProfile, '0000'), false)
    assert.doesNotMatch(JSON.stringify(protectedProfile), /2468/)
    assert.doesNotMatch(dom.window.localStorage.getItem(PROFILE_SHORTCUTS_KEY) ?? '', /2468/)
  })

  it('allows an unprotected shortcut and removes an existing PIN', async () => {
    const profile = upsertProfileShortcut({
      id: 'u1',
      email: 'ada@example.com',
      displayName: 'Ada',
      avatarId: 'wave',
    })
    assert.equal(await verifyProfilePin(profile, 'anything'), true)

    await setProfilePin(profile.id, '1357')
    const unprotectedProfile = clearProfilePin(profile.id)

    assert.equal('pin' in unprotectedProfile, false)
    assert.equal(await verifyProfilePin(unprotectedProfile, 'anything'), true)
  })
})
