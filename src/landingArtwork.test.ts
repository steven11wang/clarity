import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { JSDOM } from 'jsdom'

const landingHtml = readFileSync(
  new URL('../landing.html', import.meta.url),
  'utf8',
)

test('the closing artwork renders the supplied river-city panorama', () => {
  const document = new JSDOM(landingHtml).window.document
  const artwork = document.querySelector<HTMLImageElement>('.close-art img')

  assert.ok(artwork, 'expected the closing artwork image')
  assert.equal(artwork.getAttribute('src'), '/brand/landing/river-city-panorama.png')
  assert.equal(artwork.getAttribute('width'), '2172')
  assert.equal(artwork.getAttribute('height'), '724')
  assert.equal(
    artwork.getAttribute('alt'),
    'Sepia ink panorama of a riverside city with bridges, boats, streets, and distant mountains.',
  )

  const png = readFileSync(
    new URL('../public/brand/landing/river-city-panorama.png', import.meta.url),
  )

  assert.equal(png.toString('ascii', 1, 4), 'PNG')
  assert.equal(png.readUInt32BE(16), 2172)
  assert.equal(png.readUInt32BE(20), 724)
})
