import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('primary panels crossfade without moving the console scene', () => {
  const stylesheet = readFileSync(
    new URL('./console-theme.css', import.meta.url),
    'utf8',
  )

  assert.match(
    stylesheet,
    /\.console-primary-transition\s*\{[^}]*position:\s*relative/s,
  )
  assert.match(stylesheet, /@keyframes consolePrimaryEnter/)
  assert.match(stylesheet, /@keyframes consolePrimaryExit/)
  assert.match(
    stylesheet,
    /\.console-primary-layer--entering\s*\{[^}]*animation:[^;]*350ms/s,
  )
})

test('primary panel movement is removed for reduced motion', () => {
  const stylesheet = readFileSync(
    new URL('./console-theme.css', import.meta.url),
    'utf8',
  )

  assert.match(
    stylesheet,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.console-primary-layer--entering,[\s\S]*\.console-primary-layer--exiting\s*\{[^}]*animation:\s*none[^}]*transform:\s*none/s,
  )
})
