// Node's test runner strips TypeScript types but does not compile JSX, so a
// test that mounts a React component cannot be run from source. This bundles
// the *.dom.test.tsx files into plain ESM that `node --test` then picks up
// alongside the ordinary tests.
//
// Run automatically by `npm test` (see package.json).

import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'tools', 'dom-tests')

function findDomTests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return findDomTests(full)
    return entry.name.endsWith('.dom.test.tsx') ? [full] : []
  })
}

const entryPoints = findDomTests(join(root, 'src'))
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

if (entryPoints.length === 0) {
  console.log('no DOM tests to bundle')
  process.exit(0)
}

await build({
  entryPoints: entryPoints.map((file) => ({
    in: file,
    // "src/components/Lesson/SkillLesson.dom" -> a flat, unique test name.
    out: relative(join(root, 'src'), file)
      .replace(/\.dom\.test\.tsx$/, '')
      .replace(/[\\/]/g, '-'),
  })),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  jsx: 'automatic',
  outdir: outDir,
  outExtension: { '.js': '.test.mjs' },
  // Keep real modules external so the bundle resolves them from node_modules.
  external: [
    'node:*',
    'jsdom',
    'lucide-react',
    'react',
    'react/*',
    'react-dom',
    'react-dom/*',
  ],
  loader: { '.css': 'empty', '.json': 'json' },
  absWorkingDir: root,
  logLevel: 'warning',
})

console.log(`bundled ${entryPoints.length} DOM test file(s)`)
