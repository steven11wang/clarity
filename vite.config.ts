import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { scoreVisionPlugin } from './server/scoreVisionPlugin.ts'

export default defineConfig(async ({ command }) => {
  const plugins = [react(), scoreVisionPlugin()]

  if (command === 'build') {
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
  }
})
