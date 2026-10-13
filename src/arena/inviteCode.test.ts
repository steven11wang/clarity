import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseInviteCode } from './inviteCode.ts'

describe('parseInviteCode', () => {
  it('accepts a bare code in any case, with stray spaces or dashes', () => {
    assert.equal(parseInviteCode('K7M2QX'), 'K7M2QX')
    assert.equal(parseInviteCode('  k7m2qx '), 'K7M2QX')
    assert.equal(parseInviteCode('k7m-2qx'), 'K7M2QX')
  })

  it('pulls the code out of a pasted invite link', () => {
    assert.equal(parseInviteCode('https://satclarity.com/app/?arena=K7M2QX'), 'K7M2QX')
    assert.equal(parseInviteCode('https://satclarity.com/app/?x=1&arena=k7m2qx#top'), 'K7M2QX')
  })

  it('rejects anything that cannot be a code', () => {
    assert.equal(parseInviteCode(''), null)
    assert.equal(parseInviteCode('K7M2Q'), null)
    assert.equal(parseInviteCode('K7M2QXZ'), null)
    assert.equal(parseInviteCode('K7M2O0'), null) // O and 0 are not in the alphabet
    assert.equal(parseInviteCode('https://satclarity.com/app/'), null)
  })
})
