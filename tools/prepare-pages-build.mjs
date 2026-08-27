// Reshapes dist/ for a static host that has no rewrite engine.
//
// In development the front door is a Vite middleware (FRONT_DOOR in
// vite.config.ts) and on cPanel it was mod_rewrite (.htaccess in
// package-cpanel.mjs). GitHub Pages has neither, so the same URL map is baked
// into the directory layout instead: a folder per public path, each holding an
// index.html.
//
//   /        -> landing.html      (marketing front page)
//   /plans   -> plans.html
//   /app     -> index.html        (the React console)
//
// Run after `npm run build`. Set CUSTOM_DOMAIN to emit a CNAME.

import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const dist = 'dist'
const base = process.env.BASE_URL || '/'
const customDomain = process.env.CUSTOM_DOMAIN?.trim()

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error(`✗ ${dist}/index.html is missing. Run "npm run build" first.`)
  process.exit(1)
}

/** Vite already rewrote the references it emitted, but the hand written links
 *  in the static pages ("/plans", "/app", "/brand/...") are absolute. Under a
 *  project page such as /clarity/ those resolve to the wrong origin path, so
 *  they are prefixed here. Anything already carrying the prefix is left alone. */
async function applyBase(file) {
  if (base === '/') return
  const prefix = base.replace(/\/$/, '')
  const html = await readFile(file, 'utf8')
  const patched = html.replace(
    /\b(href|src)="\/(?!\/)([^"]*)"/g,
    (match, attribute, rest) => {
      if (rest === prefix.slice(1) || rest.startsWith(`${prefix.slice(1)}/`)) return match
      return `${attribute}="${prefix}/${rest}"`
    },
  )
  if (patched !== html) await writeFile(file, patched)
}

async function page(name, source) {
  const directory = path.join(dist, name)
  await mkdir(directory, { recursive: true })
  await copyFile(path.join(dist, source), path.join(directory, 'index.html'))
  await applyBase(path.join(directory, 'index.html'))
  console.log(`  /${name} -> ${source}`)
}

console.log('📁 Shaping dist/ for static hosting...')

// Order matters: the React app has to be copied out of dist/index.html before
// the landing page overwrites that slot.
await page('app', 'index.html')
await page('plans', 'plans.html')

await copyFile(path.join(dist, 'landing.html'), path.join(dist, 'index.html'))
await applyBase(path.join(dist, 'index.html'))
console.log('  / -> landing.html')

// Unknown paths land on the marketing page, matching what the cPanel rewrite
// rules did. The app itself has no client side routes to preserve.
await copyFile(path.join(dist, 'index.html'), path.join(dist, '404.html'))
console.log('  404 -> landing.html')

// The originals stay reachable at their own names for anything still linking
// to them, so they need the same treatment.
for (const file of await readdir(dist)) {
  if (file.endsWith('.html') && file !== 'index.html' && file !== '404.html') {
    await applyBase(path.join(dist, file))
  }
}

// Pages runs Jekyll unless told not to, which would drop underscore prefixed
// build output.
await writeFile(path.join(dist, '.nojekyll'), '')

if (customDomain) {
  await writeFile(path.join(dist, 'CNAME'), `${customDomain}\n`)
  console.log(`  CNAME -> ${customDomain}`)
}

console.log('✓ dist/ ready to publish')
