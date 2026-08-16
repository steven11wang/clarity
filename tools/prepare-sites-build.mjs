import { existsSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'

if (existsSync('dist/clarity/index.js')) {
  await rm('dist/server', { recursive: true, force: true })
  await mkdir('dist/server', { recursive: true })
  await cp('dist/clarity/index.js', 'dist/server/index.js')
  await cp('dist/clarity/wrangler.json', 'dist/server/wrangler.json')
}
