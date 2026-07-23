import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { ReviewItem } from '../types.ts'
import {
  DEMO_INTERVALS_MS,
  RETIRED_STAGE,
  applyReview,
  isClean,
  isDue,
  scheduleMistake,
} from './schedule.ts'

describe('resurrection schedule', () => {
  it('schedules a fresh miss at stage 0 with the first interval', () => {
    const item = scheduleMistake(null, 'q1', 'miss', true, 1000)
    assert.equal(item.stage, 0)
    assert.equal(item.dueAt, 1000 + DEMO_INTERVALS_MS[0])
    assert.equal(item.reason, 'miss')
  })

  it('only counts a correct answer WITH correct evidence as clean', () => {
    assert.equal(isClean(true, 'full'), true)
    assert.equal(isClean(true, 'partial'), false) // right for the wrong-ish reason
    assert.equal(isClean(true, 'miss'), false)
    assert.equal(isClean(false, 'full'), false)
  })

  it('advances a stage on a clean clear and retires after the last', () => {
    let item = scheduleMistake(null, 'q1', 'miss', true, 0)
    item = applyReview(item, true, true, 100) // stage 0 → 1
    assert.equal(item.stage, 1)
    item = applyReview(item, true, true, 200) // stage 1 → 2
    assert.equal(item.stage, 2)
    item = applyReview(item, true, true, 300) // stage 2 → retired
    assert.equal(item.stage, RETIRED_STAGE)
    assert.equal(isDue(item, 1e15), false) // retired is never due
  })

  it('drops a failed resurfacing back to stage 0', () => {
    let item: ReviewItem = scheduleMistake(null, 'q1', 'miss', true, 0)
    item = applyReview(item, true, true, 100) // now stage 1
    item = applyReview(item, false, true, 200) // failed → back to 0
    assert.equal(item.stage, 0)
    assert.equal(item.clears, 0)
    assert.equal(item.dueAt, 200 + DEMO_INTERVALS_MS[0])
  })
})
