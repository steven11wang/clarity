import assert from 'node:assert/strict'
import test from 'node:test'

import { primaryViewDirection } from './primaryViewTransition.ts'

test('primary views move forward in navigation order', () => {
  assert.equal(primaryViewDirection('lessons', 'library'), 1)
  assert.equal(primaryViewDirection('library', 'practice'), 1)
  assert.equal(primaryViewDirection('practice', 'reflect'), 1)
  assert.equal(primaryViewDirection('reflect', 'words'), 1)
  assert.equal(primaryViewDirection('lessons', 'words'), 1)
})

test('primary views move backward in navigation order', () => {
  assert.equal(primaryViewDirection('library', 'lessons'), -1)
  assert.equal(primaryViewDirection('practice', 'lessons'), -1)
  assert.equal(primaryViewDirection('reflect', 'practice'), -1)
  assert.equal(primaryViewDirection('words', 'reflect'), -1)
  assert.equal(primaryViewDirection('words', 'practice'), -1)
})

test('the current primary view has no direction', () => {
  assert.equal(primaryViewDirection('library', 'library'), 0)
})
