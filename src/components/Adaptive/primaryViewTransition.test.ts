import assert from 'node:assert/strict'
import test from 'node:test'

import { primaryViewDirection } from './primaryViewTransition.ts'

test('primary views move forward in navigation order', () => {
  assert.equal(primaryViewDirection('practice', 'library'), 1)
  assert.equal(primaryViewDirection('library', 'insights'), 1)
  assert.equal(primaryViewDirection('practice', 'insights'), 1)
})

test('primary views move backward in navigation order', () => {
  assert.equal(primaryViewDirection('insights', 'library'), -1)
  assert.equal(primaryViewDirection('library', 'practice'), -1)
  assert.equal(primaryViewDirection('insights', 'practice'), -1)
})

test('the current primary view has no direction', () => {
  assert.equal(primaryViewDirection('library', 'library'), 0)
})
