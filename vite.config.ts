import { fileURLToPath } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

import { scoreVisionPlugin } from './server/scoreVisionPlugin.ts'

const entry = (file: string) => fileURLToPath(new URL(file, import.meta.url))

/** The static pages own the public URLs; the React app lives under /app.
 *  Keep this table in sync with PAGE_ROUTES in server/sitesWorker.ts, which
 *  performs the same mapping in production. */
const FRONT_DOOR: Record<string, string> = {
  '/': '/landing.html',
  '/plans': '/plans.html',
  '/plans/': '/plans.html',
  '/app': '/index.html',
  '/app/': '/index.html',
}

const frontDoorPlugin = (): Plugin => ({
  name: 'clarity-front-door',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      const [pathname] = (request.url ?? '/').split('?')
      const target = FRONT_DOOR[pathname]
      if (target) request.url = target
      next()
    })
  },
})

export default defineConfig(async ({ command }) => {
  const plugins = [react(), scoreVisionPlugin(), frontDoorPlugin()]

  if (command === 'build' && process.env.DEPLOY_TARGET === 'cloudflare') {
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    plugins.push(
      cloudflare({
        config: {
          main: './server/sitesWorker.ts',
          compatibility_flags: ['nodejs_compat'],
          assets: {
            directory: './dist/client',
            binding: 'ASSETS',
            not_found_handling: 'none',
          },
        },
      }) as never,
    )
  }

  return {
    base: process.env.BASE_URL || '/',
    plugins,
    build: {
      rollupOptions: {
        input: {
          main: entry('./index.html'),
          landing: entry('./landing.html'),
          plans: entry('./plans.html'),
        },
      },
    },
  }
})
