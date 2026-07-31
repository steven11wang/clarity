import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('domain path header does not render the all domains control', () => {
  const source = readFileSync(
    new URL('./DomainPath.tsx', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(source, />All domains<\/button>/)
})

