import assert from 'node:assert/strict'
import { test } from 'node:test'

import { EVENT_NAME, cleanProps, dayGap, isPublicHost, optedOut, referrerHost, screenOf } from './track.ts'

test('props keep only short flat values', () => {
  const cleaned = cleanProps({ right: 4, first: true, where: 'hero', nested: { a: 1 }, list: [1], none: null, nan: Number.NaN, long: 'x'.repeat(200) })
  assert.deepEqual(Object.keys(cleaned).sort(), ['first', 'long', 'right', 'where'])
  assert.equal((cleaned.long as string).length, 48)
  assert.deepEqual(cleanProps(undefined), {})
})

test('a path is only the screen name, never a query or an id', () => {
  assert.equal(screenOf(''), '/')
  assert.equal(screenOf('#/'), '/')
  assert.equal(screenOf('#how'), '/how')
  assert.equal(screenOf('#/founders?code=SECRET'), '/founders')
  assert.equal(screenOf('#/arena/join/K7MPQ4'), '/arena')
})

test('a referrer is only another site’s host', () => {
  assert.equal(referrerHost('https://www.google.com/search?q=sat+practice', 'satclarity.com'), 'www.google.com')
  assert.equal(referrerHost('https://satclarity.com/app', 'satclarity.com'), null)
  assert.equal(referrerHost('', 'satclarity.com'), null)
  assert.equal(referrerHost('not a url', 'satclarity.com'), null)
})

test('Do Not Track and Global Privacy Control switch tracking off', () => {
  assert.equal(optedOut({ doNotTrack: '1' }), true)
  assert.equal(optedOut({ globalPrivacyControl: true }), true)
  assert.equal(optedOut({ doNotTrack: null }), false)
  assert.equal(optedOut(undefined), true)
})

test('only a published host reports', () => {
  assert.equal(isPublicHost('satclarity.com'), true)
  for (const host of ['localhost', '127.0.0.1', '[::1]', 'app.localhost', 'clarity.test', '']) assert.equal(isPublicHost(host), false)
})

test('event names are lowercase snake case', () => {
  assert.ok(EVENT_NAME.test('page_turn_in'))
  assert.ok(!EVENT_NAME.test('Page Turn In'))
  assert.ok(!EVENT_NAME.test(''))
})

test('day gap counts whole days across a month end', () => {
  assert.equal(dayGap('2026-11-11', '2026-11-11'), 0)
  assert.equal(dayGap('2026-10-30', '2026-11-06'), 7)
})
