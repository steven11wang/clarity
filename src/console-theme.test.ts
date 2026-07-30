import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('reason dropdown options use the dark console theme', () => {
  const stylesheet = readFileSync(new URL('./console-theme.css', import.meta.url), 'utf8')

  assert.match(stylesheet, /\.reason-select\s*\{[^}]*color-scheme:\s*dark/s)
  assert.match(stylesheet, /\.reason-select\s+option\s*\{[^}]*background:\s*#000000[^}]*color:\s*#ffffff/s)
})

test('selected answer letters do not receive a circular badge', () => {
  const stylesheet = readFileSync(new URL('./console-theme.css', import.meta.url), 'utf8')

  assert.match(stylesheet, /\.choice--selected \.choice-letter\s*\{[^}]*background:\s*transparent[^}]*color:\s*var\(--console-text\)/s)
  assert.match(stylesheet, /\.batch-choice--selected \.choice-letter\s*\{[^}]*background:\s*transparent[^}]*color:\s*var\(--console-text\)/s)
})

test('answer letters do not render oval backgrounds before selection', () => {
  const stylesheet = readFileSync(new URL('./console-theme.css', import.meta.url), 'utf8')

  assert.match(stylesheet, /(?:^|\n)\.choice-letter\s*\{\s*background:\s*transparent;\s*color:\s*var\(--console-text\);\s*\}/s)
})

test('primary panels crossfade without moving the console scene', () => {
  const stylesheet = readFileSync(new URL('./console-theme.css', import.meta.url), 'utf8')

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
  const stylesheet = readFileSync(new URL('./console-theme.css', import.meta.url), 'utf8')

  assert.match(
    stylesheet,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.console-primary-layer--entering,[\s\S]*\.console-primary-layer--exiting\s*\{[^}]*animation:\s*none[^}]*transform:\s*none/s,
  )
})
